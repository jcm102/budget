'use server';

import { db } from '@/lib/firebase-admin';
import type { Task, Subtask } from '@/types';

const TASKS_COLLECTION = 'tasks';

/**
 * FETCH ALL TASKS
 */
export async function getTasks(): Promise<Task[]> {
  try {
    const snapshot = await db.collection(TASKS_COLLECTION).orderBy('order', 'asc').get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Task));
  } catch (error) {
    console.error('Error fetching tasks (likely missing index):', error);
    // Fallback if the index isn't ready yet
    const snapshot = await db.collection(TASKS_COLLECTION).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
  }
}

/**
 * ADD NEW TASK
 */
export async function addTask(
  taskData: Omit<Task, 'id' | 'completed' | 'completedAt' | 'subtasks' | 'order'>, 
  order: number
): Promise<Task> {
  const newTask = {
    ...taskData,
    order,
    completed: false,
    completedAt: null,
    subtasks: [],
    createdAt: new Date().toISOString()
  };
  
  const docRef = await db.collection(TASKS_COLLECTION).add(newTask);
  const doc = await docRef.get();
  return { id: doc.id, ...doc.data() } as Task;
}

/**
 * UPDATE TASK
 */
export async function updateTask(id: string, taskData: Partial<Task>): Promise<void> {
  await db.collection(TASKS_COLLECTION).doc(id).update(taskData);
}

/**
 * DELETE TASK
 */
export async function deleteTask(id: string): Promise<void> {
  await db.collection(TASKS_COLLECTION).doc(id).delete();
}

/**
 * UPDATE TASK ORDER (BATCH)
 */
export async function updateTaskOrder(tasks: Task[]): Promise<void> {
  const batch = db.batch();
  tasks.forEach((task) => {
    const ref = db.collection(TASKS_COLLECTION).doc(task.id);
    batch.update(ref, { order: task.order });
  });
  await batch.commit();
}

/**
 * SUBTASK: ADD
 */
export async function addSubtask(taskId: string, subtask: Omit<Subtask, 'id' | 'completed' | 'order'>): Promise<void> {
  const taskRef = db.collection(TASKS_COLLECTION).doc(taskId);
  
  await db.runTransaction(async (transaction) => {
    const taskDoc = await transaction.get(taskRef);
    if (!taskDoc.exists) throw new Error('Task not found');

    const subtasks = taskDoc.data()?.subtasks || [];
    const newSubtask = {
      ...subtask,
      id: Math.random().toString(36).substring(2, 9),
      completed: false,
      order: subtasks.length
    };

    transaction.update(taskRef, {
      subtasks: [...subtasks, newSubtask]
    });
  });
}

/**
 * SUBTASK: UPDATE
 */
export async function updateSubtask(taskId: string, subtaskId: string, data: Partial<Subtask>): Promise<void> {
  const taskRef = db.collection(TASKS_COLLECTION).doc(taskId);
  
  await db.runTransaction(async (transaction) => {
    const taskDoc = await transaction.get(taskRef);
    if (!taskDoc.exists) return;

    const subtasks = (taskDoc.data()?.subtasks || []).map((st: Subtask) => 
      st.id === subtaskId ? { ...st, ...data } : st
    );

    transaction.update(taskRef, { subtasks });
  });
}

/**
 * SUBTASK: DELETE
 */
export async function deleteSubtask(taskId: string, subtaskId: string): Promise<void> {
  const taskRef = db.collection(TASKS_COLLECTION).doc(taskId);
  
  await db.runTransaction(async (transaction) => {
    const taskDoc = await transaction.get(taskRef);
    if (!taskDoc.exists) return;

    const subtasks = (taskDoc.data()?.subtasks || []).filter((st: Subtask) => st.id !== subtaskId);
    
    // Recalculate if the parent task is now completed (if no subtasks left or all remaining are done)
    const allDone = subtasks.length > 0 && subtasks.every((st: Subtask) => st.completed);

    transaction.update(taskRef, { 
      subtasks,
      completed: allDone,
      completedAt: allDone ? new Date().toISOString() : taskDoc.data()?.completedAt
    });
  });
}

/**
 * SUBTASK: UPDATE ORDER
 */
export async function updateSubtaskOrder(taskId: string, reorderedSubtasks: Subtask[]): Promise<void> {
  await db.collection(TASKS_COLLECTION).doc(taskId).update({
    subtasks: reorderedSubtasks
  });
}

/**
 * SUBTASK: TOGGLE COMPLETED
 */
export async function toggleSubtask(taskId: string, subtaskId: string): Promise<void> {
  const taskRef = db.collection(TASKS_COLLECTION).doc(taskId);
  
  await db.runTransaction(async (transaction) => {
    const taskDoc = await transaction.get(taskRef);
    if (!taskDoc.exists) return;

    const subtasks = (taskDoc.data()?.subtasks || []).map((st: Subtask) => {
      if (st.id === subtaskId) return { ...st, completed: !st.completed };
      return st;
    });

    const allDone = subtasks.every((st: Subtask) => st.completed);
    transaction.update(taskRef, {
      subtasks,
      completed: allDone,
      completedAt: allDone ? new Date().toISOString() : null
    });
  });
}