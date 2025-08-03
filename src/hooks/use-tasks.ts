'use client';

import { useState, useEffect, useCallback } from 'react';
import { isBefore, startOfToday, startOfWeek, startOfMonth as fnsStartOfMonth } from 'date-fns';
import type { Task, Subtask } from '@/types';

const TASKS_STORAGE_KEY = 'tasktrack-budget-tasks';

const checkAndResetTask = (task: Task, today: Date): Task => {
  if (!task.completed || !task.completedAt) {
    return task;
  }
  
  const completedDate = new Date(task.completedAt);
  let shouldReset = false;

  switch (task.frequency) {
    case 'daily':
      shouldReset = isBefore(completedDate, today);
      break;
    case 'weekly':
      // Sunday as the first day of the week
      const startOfWeekDate = startOfWeek(today, { weekStartsOn: 0 });
      shouldReset = isBefore(completedDate, startOfWeekDate);
      break;
    case 'monthly':
      const startOfMonthDate = fnsStartOfMonth(today);
      shouldReset = isBefore(completedDate, startOfMonthDate);
      break;
    default:
      break;
  }

  if (shouldReset) {
    const resetSubtasks = (task.subtasks || []).map(st => ({...st, completed: false}));
    return { ...task, completed: false, completedAt: null, subtasks: resetSubtasks };
  }

  return task;
};


export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const storedTasks = localStorage.getItem(TASKS_STORAGE_KEY);
      if (storedTasks) {
        const parsedTasks: Task[] = JSON.parse(storedTasks);
        const today = startOfToday();
        const updatedTasks = parsedTasks.map(task => checkAndResetTask(task, today));
        setTasks(updatedTasks);
      }
    } catch (error) {
      console.error('Failed to load tasks from local storage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
      } catch (error) {
        console.error('Failed to save tasks to local storage:', error);
      }
    }
  }, [tasks, isLoading]);

  const addTask = useCallback((taskData: Omit<Task, 'id' | 'completed' | 'completedAt' | 'subtasks'>) => {
    const newTask: Task = {
      ...taskData,
      id: crypto.randomUUID(),
      completed: false,
      completedAt: null,
      subtasks: [],
    };
    setTasks((prevTasks) => [...prevTasks, newTask]);
  }, []);

  const updateTask = useCallback((id: string, taskData: Partial<Omit<Task, 'id' | 'completed' | 'completedAt' | 'subtasks'>>) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === id
          ? { ...task, ...taskData }
          : task
      )
    );
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) => {
        if (task.id === id) {
          const newCompleted = !task.completed;
          const newSubtasks = (task.subtasks || []).map(st => ({...st, completed: newCompleted}));
          return { ...task, completed: newCompleted, completedAt: newCompleted ? new Date().toISOString() : null, subtasks: newSubtasks };
        }
        return task;
      })
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
  }, []);

  const addSubtask = useCallback((taskId: string, description: string) => {
    const newSubtask: Subtask = {
      id: crypto.randomUUID(),
      description,
      completed: false,
    };
    setTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        const updatedSubtasks = [...(task.subtasks || []), newSubtask];
        return { ...task, subtasks: updatedSubtasks, completed: false, completedAt: null };
      }
      return task;
    }));
  }, []);

  const updateSubtask = useCallback((taskId: string, subtaskId: string, description: string) => {
    setTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        const updatedSubtasks = (task.subtasks || []).map(subtask => 
          subtask.id === subtaskId ? { ...subtask, description } : subtask
        );
        return { ...task, subtasks: updatedSubtasks };
      }
      return task;
    }));
  }, []);
  
  const toggleSubtask = useCallback((taskId: string, subtaskId: string) => {
    setTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        let allSubtasksCompleted = true;
        const updatedSubtasks = (task.subtasks || []).map(st => {
          let newSt = st;
          if (st.id === subtaskId) {
            newSt = { ...st, completed: !st.completed };
          }
          if (!newSt.completed) allSubtasksCompleted = false;
          return newSt;
        });

        return {
          ...task,
          subtasks: updatedSubtasks,
          completed: allSubtasksCompleted,
          completedAt: allSubtasksCompleted ? new Date().toISOString() : null,
        };
      }
      return task;
    }));
  }, []);

  const deleteSubtask = useCallback((taskId: string, subtaskId: string) => {
    setTasks(prevTasks => prevTasks.map(task => {
      if (task.id === taskId) {
        const updatedSubtasks = (task.subtasks || []).filter(st => st.id !== subtaskId);
        const allSubtasksCompleted = updatedSubtasks.every(st => st.completed);
        
        return { 
          ...task, 
          subtasks: updatedSubtasks,
          completed: updatedSubtasks.length > 0 ? allSubtasksCompleted : false,
          completedAt: updatedSubtasks.length > 0 && allSubtasksCompleted ? new Date().toISOString() : null,
        };
      }
      return task;
    }));
  }, []);

  return { tasks, addTask, updateTask, toggleTask, deleteTask, isLoading, addSubtask, updateSubtask, toggleSubtask, deleteSubtask };
}
