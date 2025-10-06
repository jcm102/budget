
'use server';

import { db } from '@/lib/firebase';
import type { Task, Subtask } from '@/types';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc,
  query,
  writeBatch,
  getDoc,
  updateDoc
} from 'firebase/firestore';
import { isBefore, startOfToday, startOfWeek, startOfMonth as fnsStartOfMonth } from 'date-fns';

// This file is no longer used for fetching tasks, as that logic has been moved
// to the client-side useTasks hook for user-specific data access.
// The functions for resetting tasks are kept for potential future server-side batch jobs.

const TASKS_COLLECTION = 'tasks';

const checkAndResetTask = (task: Task): Task => {
  if (!task.completed || !task.completedAt) {
    return task;
  }
  
  const today = startOfToday();
  const completedDate = new Date(task.completedAt);
  let shouldReset = false;

  switch (task.frequency) {
    case 'daily':
      shouldReset = isBefore(completedDate, today);
      break;
    case 'weekly':
      const startOfWeekDate = startOfWeek(today, { weekStartsOn: 0 });
      shouldReset = isBefore(completedDate, startOfWeekDate);
      break;
    case 'monthly':
      const startOfMonthDate = fnsStartOfMonth(today);
      shouldReset = isBefore(completedDate, startOfMonthDate);
      break;
  }

  if (shouldReset) {
    const resetSubtasks = (task.subtasks || []).map(st => ({...st, completed: false}));
    return { ...task, completed: false, completedAt: null, subtasks: resetSubtasks };
  }

  return task;
};
