'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Task, Subtask } from '@/types';
import { useToast } from './use-toast';
import * as TaskService from '@/services/task-service';
import * as LinkGroupService from '@/services/link-group-service';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [linkGroups, setLinkGroups] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // 1. FETCH ALL DATA
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      // We no longer pass 'db' here; the server actions handle it via admin SDK
      const [fetchedTasks, fetchedGroups] = await Promise.all([
        TaskService.getTasks(),
        LinkGroupService.getLinkGroups()
      ]);
      
      setTasks(fetchedTasks);
      setLinkGroups(fetchedGroups);
    } catch (error) {
      console.error('Failed to load tasks or link groups:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tasks from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // 2. INITIAL LOAD ON MOUNT
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 3. TASK OPERATIONS
  const addTask = useCallback(async (taskData: Omit<Task, 'id' | 'completed' | 'completedAt' | 'subtasks' | 'order'>) => {
    try {
      const nextOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.order)) + 1 : 0;
      await TaskService.addTask(taskData, nextOrder);
      await fetchData();
    } catch (error) {
      console.error('Failed to add task:', error);
      toast({ title: 'Error', description: 'Failed to add task.', variant: 'destructive' });
    }
  }, [tasks, fetchData, toast]);

  const updateTask = useCallback(async (id: string, data: Partial<Task>) => {
    try {
      // Optimistic UI update
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
      await TaskService.updateTask(id, data);
    } catch (error) {
      console.error('Failed to update task:', error);
      fetchData(); // Revert to server state on error
      toast({ title: 'Error', description: 'Failed to update task.', variant: 'destructive' });
    }
  }, [fetchData, toast]);

  const deleteTask = useCallback(async (id: string) => {
    try {
      setTasks(prev => prev.filter(t => t.id !== id));
      await TaskService.deleteTask(id);
    } catch (error) {
      console.error('Failed to delete task:', error);
      fetchData();
      toast({ title: 'Error', description: 'Failed to delete task.', variant: 'destructive' });
    }
  }, [fetchData, toast]);

  // 4. SUBTASK OPERATIONS
  const addSubtask = useCallback(async (taskId: string, subtask: Omit<Subtask, 'id' | 'completed' | 'order'>) => {
    try {
      await TaskService.addSubtask(taskId, subtask);
      await fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add subtask.', variant: 'destructive' });
    }
  }, [fetchData, toast]);

  const updateSubtask = useCallback(async (taskId: string, subtaskId: string, data: Partial<Subtask>) => {
    try {
      await TaskService.updateSubtask(taskId, subtaskId, data);
      await fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update subtask.', variant: 'destructive' });
    }
  }, [fetchData, toast]);

  const toggleSubtask = useCallback(async (taskId: string, subtaskId: string) => {
    try {
      await TaskService.toggleSubtask(taskId, subtaskId);
      await fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to toggle subtask.', variant: 'destructive' });
    }
  }, [fetchData, toast]);

  const deleteSubtask = useCallback(async (taskId: string, subtaskId: string) => {
    try {
      await TaskService.deleteSubtask(taskId, subtaskId);
      await fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete subtask.', variant: 'destructive' });
    }
  }, [fetchData, toast]);

  // 5. DRAG & DROP REORDERING
  const reorderTasks = useCallback(async (reorderedTasks: Task[]) => {
    try {
      setTasks(reorderedTasks);
      await TaskService.updateTaskOrder(reorderedTasks);
    } catch (error) {
      fetchData();
      toast({ title: 'Error', description: 'Failed to save new order.', variant: 'destructive' });
    }
  }, [fetchData, toast]);

  return { 
    tasks, 
    linkGroups, 
    isLoading, 
    addTask, 
    updateTask, 
    deleteTask, 
    reorderTasks,
    addSubtask, 
    updateSubtask,
    toggleSubtask, 
    deleteSubtask,
    refreshTasks