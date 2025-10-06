
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

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


export async function getTasks(): Promise<Task[]> {
  const tasksCollection = collection(db, TASKS_COLLECTION);
  const q = query(tasksCollection);

  try {
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    let hasChanges = false;

    const tasks = querySnapshot.docs.map(doc => {
      const taskData = { id: doc.id, ...doc.data() } as Task;
      const updatedTask = checkAndResetTask(taskData);
      if (JSON.stringify(taskData) !== JSON.stringify(updatedTask)) {
        hasChanges = true;
        const taskRef = doc.ref;
        batch.set(taskRef, updatedTask);
      }
      return updatedTask;
    });

    if (hasChanges) {
      await batch.commit();
    }

    return tasks;
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      const contextualError = new FirestorePermissionError({
        operation: 'list',
        path: TASKS_COLLECTION,
      });
      errorEmitter.emit('permission-error', contextualError);
    }
    // Re-throw other errors or handle them as needed
    throw error;
  }
}

export async function addTask(taskData: Omit<Task, 'id' | 'completed' | 'completedAt' | 'subtasks' | 'order'>, order: number): Promise<Task> {
  const newTask: Omit<Task, 'id'> = {
    ...taskData,
    completed: false,
    completedAt: null,
    subtasks: [],
    order,
    linkGroupId: taskData.linkGroupId || null,
    links: taskData.links || [],
    internalLink: taskData.internalLink || null,
  };
  const docRef = doc(collection(db, TASKS_COLLECTION));
  
  setDoc(docRef, newTask).catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: docRef.path,
        operation: 'create',
        requestResourceData: newTask,
      })
    );
  });

  return { ...newTask, id: docRef.id };
}

export async function updateTask(id: string, taskData: Partial<Omit<Task, 'id'>>): Promise<void> {
  const taskRef = doc(db, TASKS_COLLECTION, id);
  const docSnap = await getDoc(taskRef);
  if (docSnap.exists()) {
    const dataToUpdate = { ...taskData };
    updateDoc(taskRef, dataToUpdate).catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: taskRef.path,
          operation: 'update',
          requestResourceData: dataToUpdate,
        })
      );
    });
  } else {
    throw new Error(`Task with id ${id} not found.`);
  }
}

export async function updateTaskOrder(tasks: Task[]): Promise<void> {
  const batch = writeBatch(db);
  tasks.forEach((task, index) => {
    const taskRef = doc(db, TASKS_COLLECTION, task.id);
    batch.update(taskRef, { order: index });
  });
  
  batch.commit().catch(error => {
     errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: TASKS_COLLECTION,
          operation: 'write', // Batch writes are generic
        })
      );
  });
}

export async function deleteTask(id: string): Promise<void> {
  const taskRef = doc(db, TASKS_COLLECTION, id);
  deleteDoc(taskRef).catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: taskRef.path,
        operation: 'delete',
      })
    );
  });
}

export async function addSubtask(taskId: string, data: Omit<Subtask, 'id' | 'completed' | 'order'>): Promise<void> {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const docSnap = await getDoc(taskRef);
  if (!docSnap.exists()) throw new Error(`Task with id ${taskId} not found.`);

  const task = docSnap.data() as Task;
  const newOrder = task.subtasks ? task.subtasks.length : 0;
  const newSubtask: Subtask = {
    id: crypto.randomUUID(),
    description: data.description,
    completed: false,
    order: newOrder,
    links: data.links || [],
    linkGroupId: data.linkGroupId || null,
    internalLink: data.internalLink || null,
  };
  const updatedSubtasks = [...(task.subtasks || []), newSubtask];
  
  updateDoc(taskRef, { subtasks: updatedSubtasks, completed: false, completedAt: null }).catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: taskRef.path,
        operation: 'update',
        requestResourceData: { subtasks: updatedSubtasks },
      })
    );
  });
}

export async function updateSubtask(taskId: string, subtaskId: string, subtaskData: Partial<Omit<Subtask, 'id' | 'completed' | 'order'>>): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const docSnap = await getDoc(taskRef);
    if (!docSnap.exists()) throw new Error(`Task with id ${taskId} not found.`);
    
    const task = docSnap.data() as Task;
    const updatedSubtasks = (task.subtasks || []).map(subtask => 
      subtask.id === subtaskId ? { ...subtask, ...subtaskData } : subtask
    );

    updateDoc(taskRef, { subtasks: updatedSubtasks }).catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: taskRef.path,
          operation: 'update',
          requestResourceData: { subtasks: updatedSubtasks },
        })
      );
    });
}

export async function updateSubtaskOrder(taskId: string, subtasks: Subtask[]): Promise<void> {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const docSnap = await getDoc(taskRef);
  if (!docSnap.exists()) throw new Error(`Task with id ${taskId} not found.`);
  
  const updatedSubtasks = subtasks.map((subtask, index) => ({...subtask, order: index}));

  updateDoc(taskRef, { subtasks: updatedSubtasks }).catch(error => {
     errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: taskRef.path,
          operation: 'update',
          requestResourceData: { subtasks: updatedSubtasks },
        })
      );
  });
}

export async function toggleSubtask(taskId: string, subtaskId: string): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const docSnap = await getDoc(taskRef);
    if (!docSnap.exists()) throw new Error(`Task with id ${taskId} not found.`);
    
    let task = docSnap.data() as Task;
    const updatedSubtasks = (task.subtasks || []).map(st => 
        st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );

    const allSubtasksCompleted = updatedSubtasks.every(st => st.completed);

    const updatedTask = {
        subtasks: updatedSubtasks,
        completed: allSubtasksCompleted,
        completedAt: allSubtasksCompleted ? new Date().toISOString() : null,
    };
    updateDoc(taskRef, updatedTask).catch(error => {
       errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: taskRef.path,
          operation: 'update',
          requestResourceData: updatedTask,
        })
      );
    });
}

export async function deleteSubtask(taskId: string, subtaskId: string): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const docSnap = await getDoc(taskRef);
    if (!docSnap.exists()) throw new Error(`Task with id ${taskId} not found.`);

    let task = docSnap.data() as Task;
    const updatedSubtasks = (task.subtasks || []).filter(st => st.id !== subtaskId);
    const allSubtasksCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every(st => st.completed);

    const updatedTask = {
        subtasks: updatedSubtasks,
        completed: allSubtasksCompleted,
        completedAt: allSubtasksCompleted ? new Date().toISOString() : null,
    };
    updateDoc(taskRef, updatedTask).catch(error => {
       errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: taskRef.path,
          operation: 'update',
          requestResourceData: updatedTask,
        })
      );
    });
}
