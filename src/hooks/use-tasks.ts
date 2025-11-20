'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Task, Subtask, LinkGroup } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as TaskService from '@/services/task-service';
import * as LinkGroupService from '@/services/link-group-service';
import { useUser } from '@/firebase';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [linkGroups, setLinkGroups] = useState<LinkGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();

  const fetchData = useCallback(async (currentUserId?: string) => {
    if (!currentUserId) {
      setTasks([]);
      setLinkGroups([]);
      setIsLoading(false);
      return;
    };
    try {
      setIsLoading(true);
      const [fetchedTasks, fetchedLinkGroups] = await Promise.all([
        TaskService.getTasks(currentUserId),
        LinkGroupService.getLinkGroups(currentUserId),
      ]);
      setTasks(fetchedTasks);
      setLinkGroups(fetchedLinkGroups);
    } catch (error) {
      console.error('Failed to load tasks or link groups:', error);
      toast({
        title: 'Error',
        description: 'Failed to load data from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isUserLoading) {
      fetchData(user?.uid);
    }
  }, [user, isUserLoading, fetchData]);

  const addTask = useCallback(async (taskData: Omit<Task, 'id' | 'completed' | 'completedAt' | 'subtasks' | 'order'>) => {
    if (!user) return;
    try {
      const newOrder = tasks.filter(t => t.frequency === taskData.frequency).length;
      const newTask = await TaskService.addTask(user.uid, taskData, newOrder);
      setTasks((prevTasks) => [...prevTasks, newTask]);
    } catch (error) {
      console.error('Failed to add task:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new task.',
        variant: 'destructive',
      });
    }
  }, [toast, tasks, user]);

  const updateTask = useCallback(async (id: string, taskData: Partial<Omit<Task, 'id'>>) => {
    if (!user) return;
    try {
      await TaskService.updateTask(user.uid, id, taskData);
       // Refetch all data to ensure consistency
      await fetchData(user.uid);
    } catch (error) {
      console.error('Failed to update task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the task.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchData, user]);

  const updateTaskOrder = useCallback(async (reorderedTasks: Task[]) => {
    if (!user) return;
    // Optimistically update the UI
    setTasks(reorderedTasks);
    try {
      await TaskService.updateTaskOrder(user.uid, reorderedTasks);
    } catch (error) {
      console.error('Failed to update task order:', error);
      // Revert on error - though fetching might be better
      toast({
        title: 'Error',
        description: 'Failed to save the new task order.',
        variant: 'destructive',
      });
    }
  }, [toast, user]);

  const toggleTask = useCallback(async (id: string) => {
    if (!user) return;
    const originalTasks = tasks;
    const taskToToggle = tasks.find((t) => t.id === id);
    if (!taskToToggle) return;

    const newCompleted = !taskToToggle.completed;
    const newCompletedAt = newCompleted ? new Date().toISOString() : null;
    const updatedSubtasks = (taskToToggle.subtasks || []).map(st => ({...st, completed: newCompleted}));

    const updatedTask = { ...taskToToggle, completed: newCompleted, completedAt: newCompletedAt, subtasks: updatedSubtasks };

    setTasks(tasks.map((t) => (t.id === id ? updatedTask : t)));

    try {
      await TaskService.updateTask(user.uid, id, { completed: newCompleted, completedAt: newCompletedAt, subtasks: updatedSubtasks });
    } catch (error) {
      console.error('Failed to toggle task:', error);
      setTasks(originalTasks);
      toast({
        title: 'Error',
        description: 'Failed to update the task status.',
        variant: 'destructive',
      });
    }
  }, [tasks, toast, user]);

  const deleteTask = useCallback(async (id: string) => {
    if (!user) return;
    const originalTasks = tasks;
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
    try {
      await TaskService.deleteTask(user.uid, id);
    } catch (error) {
      console.error('Failed to delete task:', error);
      setTasks(originalTasks);
      toast({
        title: 'Error',
        description: 'Failed to delete the task.',
        variant: 'destructive',
      });
    }
  }, [tasks, toast, user]);

  const addSubtask = useCallback(async (taskId: string, data: Omit<Subtask, 'id' | 'completed' | 'order'>) => {
    if (!user) return;
    try {
      await TaskService.addSubtask(user.uid, taskId, data);
      await fetchData(user.uid);
    } catch (error) {
      console.error('Failed to add subtask:', error);
      toast({ title: 'Error', description: 'Failed to add subtask.', variant: 'destructive' });
    }
  }, [fetchData, toast, user]);
  
  const updateSubtask = useCallback(async (taskId: string, subtaskId: string, data: Partial<Omit<Subtask, 'id' | 'completed' | 'order'>>) => {
    if (!user) return;
    try {
      await TaskService.updateSubtask(user.uid, taskId, subtaskId, data);
      await fetchData(user.uid);
    } catch (error) {
      console.error('Failed to update subtask:', error);
      toast({ title: 'Error', description: 'Failed to update subtask.', variant: 'destructive' });
    }
  }, [fetchData, toast, user]);

  const updateSubtaskOrder = useCallback(async (taskId: string, reorderedSubtasks: Subtask[]) => {
    if (!user) return;
    const originalTasks = [...tasks];
    const newTasks = tasks.map(task => {
        if (task.id === taskId) {
            return { ...task, subtasks: reorderedSubtasks };
        }
        return task;
    });
    setTasks(newTasks);

    try {
        await TaskService.updateSubtaskOrder(user.uid, taskId, reorderedSubtasks);
    } catch (error) {
        console.error('Failed to update subtask order:', error);
        setTasks(originalTasks);
        toast({ title: 'Error', description: 'Failed to save subtask order.', variant: 'destructive' });
    }
  }, [tasks, toast, user]);

  const toggleSubtask = useCallback(async (taskId: string, subtaskId: string) => {
    if (!user) return;
    const originalTasks = tasks;
     setTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        const updatedSubtasks = (task.subtasks || []).map(st => 
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
        );
        const allSubtasksCompleted = updatedSubtasks.every(st => st.completed);
        return {
          ...task,
          subtasks: updatedSubtasks,
          completed: allSubtasksCompleted,
          completedAt: allSubtasksCompleted ? new Date().toISOString() : null,
        };
      }
      return task;
    }));

    try {
        await TaskService.toggleSubtask(user.uid, taskId, subtaskId);
    } catch (error) {
        console.error('Failed to toggle subtask:', error);
        setTasks(originalTasks); // Revert on error
        toast({ title: 'Error', description: 'Failed to toggle subtask status.', variant: 'destructive' });
    }
  }, [tasks, toast, user]);

  const deleteSubtask = useCallback(async (taskId: string, subtaskId: string) => {
    if (!user) return;
    const originalTasks = tasks;
     setTasks(prevTasks => prevTasks.map(task => {
        if (task.id === taskId) {
            const updatedSubtasks = (task.subtasks || []).filter(st => st.id !== subtaskId);
            const allSubtasksCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every(st => st.completed);
            return { 
                ...task, 
                subtasks: updatedSubtasks,
                completed: allSubtasksCompleted,
                completedAt: allSubtasksCompleted ? new Date().toISOString() : null,
            };
        }
        return task;
    }));
    try {
        await TaskService.deleteSubtask(user.uid, taskId, subtaskId);
    } catch (error) {
        console.error('Failed to delete subtask:', error);
        setTasks(originalTasks);
        toast({ title: 'Error', description: 'Failed to delete subtask.', variant: 'destructive' });
    }
  }, [tasks, toast, user]);


  return { tasks, linkGroups, addTask, updateTask, toggleTask, deleteTask, isLoading: isLoading || isUserLoading, updateTaskOrder, addSubtask, updateSubtask, updateSubtaskOrder, toggleSubtask, deleteSubtask };
}
