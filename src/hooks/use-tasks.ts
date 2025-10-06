
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Task, Subtask, LinkGroup } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as TaskService from '@/services/task-service';
import * as LinkGroupService from '@/services/link-group-service';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { collection, getDocs, query } from 'firebase/firestore';
import { useFirestore } from '@/firebase';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [linkGroups, setLinkGroups] = useState<LinkGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const firestore = useFirestore();

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      const tasksPromise = getDocs(query(collection(firestore, 'tasks'))).catch(error => {
          if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: 'tasks',
              operation: 'list'
            }));
          }
          throw error;
      });

      const linkGroupsPromise = getDocs(query(collection(firestore, 'link-groups'))).catch(error => {
        if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: 'link-groups',
              operation: 'list'
            }));
          }
          throw error;
      });

      const [tasksSnapshot, linkGroupsSnapshot] = await Promise.all([tasksPromise, linkGroupsPromise]);

      const fetchedTasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[];
      const fetchedLinkGroups = linkGroupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as LinkGroup[];

      setTasks(fetchedTasks);
      setLinkGroups(fetchedLinkGroups);

    } catch (error: any) {
      if (error.name !== 'FirebaseError') { // Don't toast for permission errors that are handled globally
        console.error('Failed to load tasks or link groups:', error);
        toast({
          title: 'Error',
          description: 'Failed to load data from the database.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [toast, firestore]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const addTask = useCallback(async (taskData: Omit<Task, 'id' | 'completed' | 'completedAt' | 'subtasks' | 'order'>) => {
    try {
      const newOrder = tasks.filter(t => t.frequency === taskData.frequency).length;
      const newTask = await TaskService.addTask(taskData, newOrder);
      setTasks((prevTasks) => [...prevTasks, newTask]);
    } catch (error) {
       toast({
        title: 'Error',
        description: 'Failed to add the new task.',
        variant: 'destructive',
      });
    }
  }, [toast, tasks]);

  const updateTask = useCallback(async (id: string, taskData: Partial<Omit<Task, 'id'>>) => {
    try {
      await TaskService.updateTask(id, taskData);
       await fetchData();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update the task.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchData]);

  const updateTaskOrder = useCallback(async (reorderedTasks: Task[]) => {
    setTasks(reorderedTasks);
    try {
      await TaskService.updateTaskOrder(reorderedTasks);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save the new task order.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const toggleTask = useCallback(async (id: string) => {
    const originalTasks = tasks;
    const taskToToggle = tasks.find((t) => t.id === id);
    if (!taskToToggle) return;

    const newCompleted = !taskToToggle.completed;
    const newCompletedAt = newCompleted ? new Date().toISOString() : null;
    const updatedSubtasks = (taskToToggle.subtasks || []).map(st => ({...st, completed: newCompleted}));

    const updatedTask = { ...taskToToggle, completed: newCompleted, completedAt: newCompletedAt, subtasks: updatedSubtasks };

    setTasks(tasks.map((t) => (t.id === id ? updatedTask : t)));

    try {
      await TaskService.updateTask(id, { completed: newCompleted, completedAt: newCompletedAt, subtasks: updatedSubtasks });
    } catch (error) {
      setTasks(originalTasks);
      toast({
        title: 'Error',
        description: 'Failed to update the task status.',
        variant: 'destructive',
      });
    }
  }, [tasks, toast]);

  const deleteTask = useCallback(async (id: string) => {
    const originalTasks = tasks;
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
    try {
      await TaskService.deleteTask(id);
    } catch (error) {
      setTasks(originalTasks);
      toast({
        title: 'Error',
        description: 'Failed to delete the task.',
        variant: 'destructive',
      });
    }
  }, [tasks, toast]);

  const addSubtask = useCallback(async (taskId: string, data: Omit<Subtask, 'id' | 'completed' | 'order'>) => {
    try {
      await TaskService.addSubtask(taskId, data);
      await fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add subtask.', variant: 'destructive' });
    }
  }, [fetchData, toast]);
  
  const updateSubtask = useCallback(async (taskId: string, subtaskId: string, data: Partial<Omit<Subtask, 'id' | 'completed' | 'order'>>) => {
    try {
      await TaskService.updateSubtask(taskId, subtaskId, data);
      await fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update subtask.', variant: 'destructive' });
    }
  }, [fetchData, toast]);

  const updateSubtaskOrder = useCallback(async (taskId: string, reorderedSubtasks: Subtask[]) => {
    const originalTasks = [...tasks];
    const newTasks = tasks.map(task => {
        if (task.id === taskId) {
            return { ...task, subtasks: reorderedSubtasks };
        }
        return task;
    });
    setTasks(newTasks);

    try {
        await TaskService.updateSubtaskOrder(taskId, reorderedSubtasks);
    } catch (error) {
        setTasks(originalTasks);
        toast({ title: 'Error', description: 'Failed to save subtask order.', variant: 'destructive' });
    }
  }, [tasks, toast]);

  const toggleSubtask = useCallback(async (taskId: string, subtaskId: string) => {
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
        await TaskService.toggleSubtask(taskId, subtaskId);
    } catch (error) {
        setTasks(originalTasks); // Revert on error
        toast({ title: 'Error', description: 'Failed to toggle subtask status.', variant: 'destructive' });
    }
  }, [tasks, toast]);

  const deleteSubtask = useCallback(async (taskId: string, subtaskId: string) => {
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
        await TaskService.deleteSubtask(taskId, subtaskId);
    } catch (error) {
        setTasks(originalTasks);
        toast({ title: 'Error', description: 'Failed to delete subtask.', variant: 'destructive' });
    }
  }, [tasks, toast]);


  return { tasks, linkGroups, addTask, updateTask, toggleTask, deleteTask, isLoading, updateTaskOrder, addSubtask, updateSubtask, updateSubtaskOrder, toggleSubtask, deleteSubtask };
}
