
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Task, Subtask } from '@/types';
import { useToast } from './use-toast';
import * as TaskService from '@/services/task-service';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        setIsLoading(true);
        const fetchedTasks = await TaskService.getTasks();
        setTasks(fetchedTasks);
      } catch (error) {
        console.error('Failed to load tasks:', error);
        toast({
          title: 'Error',
          description: 'Failed to load tasks from the database.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchTasks();
  }, [toast]);

  const addTask = useCallback(async (taskData: Omit<Task, 'id' | 'completed' | 'completedAt' | 'subtasks'>) => {
    try {
      const newTask = await TaskService.addTask(taskData);
      setTasks((prevTasks) => [...prevTasks, newTask]);
    } catch (error) {
      console.error('Failed to add task:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new task.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const updateTask = useCallback(async (id: string, taskData: Partial<Omit<Task, 'id'>>) => {
    try {
      await TaskService.updateTask(id, taskData);
      setTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === id ? { ...task, ...taskData } : task
        )
      );
    } catch (error) {
      console.error('Failed to update task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the task.',
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
      console.error('Failed to toggle task:', error);
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
      console.error('Failed to delete task:', error);
      setTasks(originalTasks);
      toast({
        title: 'Error',
        description: 'Failed to delete the task.',
        variant: 'destructive',
      });
    }
  }, [tasks, toast]);

  const addSubtask = useCallback(async (taskId: string, description: string) => {
    try {
      const newSubtask = await TaskService.addSubtask(taskId, description);
      setTasks(prevTasks => prevTasks.map(task => {
        if (task.id === taskId) {
            const updatedSubtasks = [...(task.subtasks || []), newSubtask];
            return { ...task, subtasks: updatedSubtasks, completed: false, completedAt: null };
        }
        return task;
      }));
    } catch (error) {
      console.error('Failed to add subtask:', error);
      toast({ title: 'Error', description: 'Failed to add subtask.', variant: 'destructive' });
    }
  }, [toast]);
  
  const updateSubtask = useCallback(async (taskId: string, subtaskId: string, description: string) => {
    const originalTasks = tasks;
    setTasks(prev => prev.map(t => t.id === taskId ? {...t, subtasks: t.subtasks.map(st => st.id === subtaskId ? {...st, description} : st)}: t));
    try {
      await TaskService.updateSubtask(taskId, subtaskId, description);
    } catch (error) {
      console.error('Failed to update subtask:', error);
      setTasks(originalTasks);
      toast({ title: 'Error', description: 'Failed to update subtask.', variant: 'destructive' });
    }
  }, [tasks, toast]);

  const toggleSubtask = useCallback(async (taskId: string, subtaskId: string) => {
    const originalTasks = tasks;
    // Optimistically update UI
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
        console.error('Failed to toggle subtask:', error);
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
        console.error('Failed to delete subtask:', error);
        setTasks(originalTasks);
        toast({ title: 'Error', description: 'Failed to delete subtask.', variant: 'destructive' });
    }
  }, [tasks, toast]);


  return { tasks, addTask, updateTask, toggleTask, deleteTask, isLoading, addSubtask, updateSubtask, toggleSubtask, deleteSubtask };
}
