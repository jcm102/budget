
'use server';

import { Firestore, collection, getDocs, doc, setDoc, deleteDoc, query, getDoc, addDoc, updateDoc, writeBatch } from 'firebase/firestore';
import type { Task, Subtask } from '@/types';

const TASKS_COLLECTION = 'tasks';

export async function getTasks(db: Firestore): Promise<Task[]> {
  const tasksCollection = collection(db, TASKS_COLLECTION);
  const q = query(tasksCollection);
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
}

export async function addTask(
  db: Firestore,
  taskData: Omit<Task, 'id' | 'completed' | 'completedAt' | 'subtasks' | 'order'>,
  order: number
): Promise<Task> {
  const newTaskData = {
    ...taskData,
    completed: false,
    completedAt: null,
    subtasks: [],
    order: order,
  };
  const docRef = await addDoc(collection(db, TASKS_COLLECTION), newTaskData);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<Task, 'id'>) };
}

export async function updateTask(db: Firestore, id: string, taskData: Partial<Omit<Task, 'id' | 'subtasks'>>): Promise<void> {
  const taskRef = doc(db, TASKS_COLLECTION, id);
  await updateDoc(taskRef, taskData);
}

export async function updateTaskOrder(db: Firestore, reorderedTasks: Task[]): Promise<void> {
    const batch = writeBatch(db);
    reorderedTasks.forEach((task, index) => {
        const taskRef = doc(db, TASKS_COLLECTION, task.id);
        batch.update(taskRef, { order: index });
    });
    await batch.commit();
}


export async function deleteTask(db: Firestore, id: string): Promise<void> {
  const taskRef = doc(db, TASKS_COLLECTION, id);
  await deleteDoc(taskRef);
}

export async function addSubtask(db: Firestore, taskId: string, data: Omit<Subtask, 'id' | 'completed' | 'order'>): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const taskSnap = await getDoc(taskRef);
    if (taskSnap.exists()) {
        const task = taskSnap.data() as Task;
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
        await updateDoc(taskRef, { subtasks: updatedSubtasks, completed: false, completedAt: null });
    }
}

export async function updateSubtask(db: Firestore, taskId: string, subtaskId: string, data: Partial<Omit<Subtask, 'id' | 'completed' | 'order'>>): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const taskSnap = await getDoc(taskRef);
    if (taskSnap.exists()) {
        const task = taskSnap.data() as Task;
        const updatedSubtasks = (task.subtasks || []).map(subtask => 
            subtask.id === subtaskId ? { ...subtask, ...data } : subtask
        );
        await updateDoc(taskRef, { subtasks: updatedSubtasks });
    }
}

export async function updateSubtaskOrder(db: Firestore, taskId: string, reorderedSubtasks: Subtask[]): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const updatedSubtasks = reorderedSubtasks.map((subtask, index) => ({...subtask, order: index }));
    await updateDoc(taskRef, { subtasks: updatedSubtasks });
}


export async function toggleSubtask(db: Firestore, taskId: string, subtaskId: string): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const taskSnap = await getDoc(taskRef);
    if (taskSnap.exists()) {
        const task = taskSnap.data() as Task;
        const updatedSubtasks = (task.subtasks || []).map(st => 
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
        );
        const allSubtasksCompleted = updatedSubtasks.every(st => st.completed);
        await updateDoc(taskRef, { 
            subtasks: updatedSubtasks,
            completed: allSubtasksCompleted,
            completedAt: allSubtasksCompleted ? new Date().toISOString() : null,
        });
    }
}

export async function deleteSubtask(db: Firestore, taskId: string, subtaskId: string): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const taskSnap = await getDoc(taskRef);
    if (taskSnap.exists()) {
        const task = taskSnap.data() as Task;
        const updatedSubtasks = (task.subtasks || []).filter(st => st.id !== subtaskId);
        const allSubtasksCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every(st => st.completed);
        await updateDoc(taskRef, { 
            subtasks: updatedSubtasks,
            completed: allSubtasksCompleted,
            completedAt: allSubtasksCompleted ? new Date().toISOString() : null,
        });
    }
}
