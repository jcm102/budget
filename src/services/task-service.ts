
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
  getDoc
} from 'firebase/firestore';
import { isBefore, startOfToday, startOfWeek, startOfMonth as fnsStartOfMonth } from 'date-fns';

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
}

export async function addTask(taskData: Omit<Task, 'id' | 'completed' | 'completedAt' | 'subtasks' | 'order'>, order: number): Promise<Task> {
  const newTask: Omit<Task, 'id'> = {
    ...taskData,
    completed: false,
    completedAt: null,
    subtasks: [],
    order,
    links: taskData.links || [],
  };
  const docRef = doc(collection(db, TASKS_COLLECTION));
  await setDoc(docRef, newTask);
  return { ...newTask, id: docRef.id };
}

export async function updateTask(id: string, taskData: Partial<Omit<Task, 'id'>>): Promise<void> {
  const taskRef = doc(db, TASKS_COLLECTION, id);
  const docSnap = await getDoc(taskRef);
  if (docSnap.exists()) {
    const existingData = docSnap.data();
    const dataToUpdate = { ...existingData, ...taskData };
    if (!('links' in taskData)) {
      dataToUpdate.links = existingData.links || [];
    }
    await setDoc(taskRef, dataToUpdate);
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
  await batch.commit();
}

export async function deleteTask(id: string): Promise<void> {
  const taskRef = doc(db, TASKS_COLLECTION, id);
  await deleteDoc(taskRef);
}

export async function addSubtask(taskId: string, description: string, order: number, link?: string): Promise<Subtask> {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const docSnap = await getDoc(taskRef);
  if (!docSnap.exists()) throw new Error(`Task with id ${taskId} not found.`);

  const task = docSnap.data() as Task;
  const newSubtask: Subtask = {
    id: crypto.randomUUID(),
    description,
    completed: false,
    order,
    link,
  };
  const updatedSubtasks = [...(task.subtasks || []), newSubtask];
  await setDoc(taskRef, { ...task, subtasks: updatedSubtasks, completed: false, completedAt: null });

  return newSubtask;
}

export async function updateSubtask(taskId: string, subtaskId: string, subtaskData: Partial<Omit<Subtask, 'id'>>): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const docSnap = await getDoc(taskRef);
    if (!docSnap.exists()) throw new Error(`Task with id ${taskId} not found.`);
    
    const task = docSnap.data() as Task;
    const updatedSubtasks = (task.subtasks || []).map(subtask => 
      subtask.id === subtaskId ? { ...subtask, ...subtaskData } : subtask
    );
    await setDoc(taskRef, { ...task, subtasks: updatedSubtasks });
}

export async function updateSubtaskOrder(taskId: string, subtasks: Subtask[]): Promise<void> {
  const taskRef = doc(db, TASKS_COLLECTION, taskId);
  const docSnap = await getDoc(taskRef);
  if (!docSnap.exists()) throw new Error(`Task with id ${taskId} not found.`);
  const task = docSnap.data() as Task;
  
  const updatedSubtasks = subtasks.map((subtask, index) => ({...subtask, order: index}));

  await setDoc(taskRef, { ...task, subtasks: updatedSubtasks });
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
        ...task,
        subtasks: updatedSubtasks,
        completed: allSubtasksCompleted,
        completedAt: allSubtasksCompleted ? new Date().toISOString() : null,
    };
    await setDoc(taskRef, updatedTask);
}

export async function deleteSubtask(taskId: string, subtaskId: string): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const docSnap = await getDoc(taskRef);
    if (!docSnap.exists()) throw new Error(`Task with id ${taskId} not found.`);

    let task = docSnap.data() as Task;
    const updatedSubtasks = (task.subtasks || []).filter(st => st.id !== subtaskId);
    const allSubtasksCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every(st => st.completed);

    const updatedTask = {
        ...task,
        subtasks: updatedSubtasks,
        completed: allSubtasksCompleted,
        completedAt: allSubtasksCompleted ? new Date().toISOString() : null,
    };
    await setDoc(taskRef, updatedTask);
}
