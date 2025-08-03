'use client';

import { useState, useEffect, useCallback } from 'react';
import { isBefore, startOfToday } from 'date-fns';
import type { Task } from '@/types';

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
      // `isBefore` check with start of the week
      const startOfWeek = (d: Date) => {
        const date = new Date(d);
        const day = date.getDay();
        const diff = date.getDate() - day + (day === 0 ? -6:1);
        return new Date(date.setDate(diff));
      }
      shouldReset = isBefore(completedDate, startOfWeek(today));
      break;
    case 'monthly':
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      shouldReset = isBefore(completedDate, startOfMonth);
      break;
    default:
      break;
  }

  if (shouldReset) {
    return { ...task, completed: false, completedAt: null };
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

  const addTask = useCallback((taskData: Omit<Task, 'id' | 'completed' | 'dueDate'>) => {
    const newTask: Task = {
      ...taskData,
      id: crypto.randomUUID(),
      completed: false,
    };
    setTasks((prevTasks) => [...prevTasks, newTask]);
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        task.id === id
          ? { ...task, completed: !task.completed, completedAt: !task.completed ? new Date().toISOString() : null }
          : task
      )
    );
  }, []);

  const deleteTask = useCallback((id: string) => {
    setTasks((prevTasks) => prevTasks.filter((task) => task.id !== id));
  }, []);

  return { tasks, addTask, toggleTask, deleteTask, isLoading };
}
