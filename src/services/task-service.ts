
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
  updateDoc,
  addDoc
} from 'firebase/firestore';
import { isBefore, startOfToday, startOfWeek, startOfMonth as fnsStartOfMonth } from 'date-fns';

const TASKS_COLLECTION = 'tasks';

export async function getTasks(): Promise<Task[]> {
  const tasksCollection = collection(db, TASKS_COLLECTION);
  const q = query(tasksCollection);
  const querySnapshot = await getDocs(q);
  const tasks = querySnapshot.docs.map(doc => checkAndResetTask({ id: doc.id, ...doc.data() } as Task));
  
  // Since we are resetting, we might need to update the documents in Firestore
  const batch = writeBatch(db);
  let hasChanges = false;
  querySnapshot.docs.forEach(docSnap => {
      const originalTask = { id: docSnap.id, ...docSnap.data() } as Task;
      const potentiallyResetTask = tasks.find(t => t.id === docSnap.id);
      if (potentiallyResetTask && originalTask.completed && !potentiallyResetTask.completed) {
          const taskRef = doc(db, TASKS_COLLECTION, docSnap.id);
          batch.update(taskRef, { 
              completed: false, 
              completedAt: null,
              subtasks: potentiallyResetTask.subtasks.map(st => ({...st, completed: false}))
            });
          hasChanges = true;
      }
  });

  if (hasChanges) {
      await batch.commit();
  }

  return tasks;
}

export async function addTask(taskData: Omit<Task, 'id' | 'completed' | 'completedAt' | 'subtasks'>, order: number): Promise<Task> {
    const taskCollection = collection(db, TASKS_COLLECTION);
    const newTaskData = {
        ...taskData,
        completed: false,
        completedAt: null,
        subtasks: [],
        order,
    };
    const docRef = await addDoc(taskCollection, newTaskData);
    return { id: docRef.id, ...newTaskData };
}

export async function updateTask(id: string, taskData: Partial<Omit<Task, 'id' | 'subtasks'>>): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, id);
    await updateDoc(taskRef, taskData);
}

export async function updateTaskOrder(reorderedTasks: Task[]): Promise<void> {
    const batch = writeBatch(db);
    reorderedTasks.forEach((task, index) => {
        const taskRef = doc(db, TASKS_COLLECTION, task.id);
        batch.update(taskRef, { order: index });
    });
    await batch.commit();
}


export async function deleteTask(id: string): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, id);
    await deleteDoc(taskRef);
}

export async function addSubtask(taskId: string, data: Omit<Subtask, 'id' | 'completed' | 'order'>): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const taskSnap = await getDoc(taskRef);
    if(taskSnap.exists()){
        const taskData = taskSnap.data() as Task;
        const newOrder = taskData.subtasks ? taskData.subtasks.length : 0;
        const newSubtask: Subtask = {
            id: crypto.randomUUID(),
            description: data.description,
            completed: false,
            order: newOrder,
            links: data.links || [],
            linkGroupId: data.linkGroupId || null,
            internalLink: data.internalLink || null,
        };
        const updatedSubtasks = [...(taskData.subtasks || []), newSubtask];
        await updateDoc(taskRef, { subtasks: updatedSubtasks, completed: false, completedAt: null });
    }
}

export async function updateSubtask(taskId: string, subtaskId: string, data: Partial<Omit<Subtask, 'id' | 'completed' | 'order'>>): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const taskSnap = await getDoc(taskRef);
    if(taskSnap.exists()){
        const taskData = taskSnap.data() as Task;
        const updatedSubtasks = (taskData.subtasks || []).map(subtask => 
            subtask.id === subtaskId ? { ...subtask, ...data } : subtask
        );
        await updateDoc(taskRef, { subtasks: updatedSubtasks });
    }
}


export async function updateSubtaskOrder(taskId: string, reorderedSubtasks: Subtask[]): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const updatedSubtasks = reorderedSubtasks.map((subtask, index) => ({...subtask, order: index}));
    await updateDoc(taskRef, { subtasks: updatedSubtasks });
}

export async function toggleSubtask(taskId: string, subtaskId: string): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const taskSnap = await getDoc(taskRef);
    if(taskSnap.exists()){
        const taskData = taskSnap.data() as Task;
        const updatedSubtasks = (taskData.subtasks || []).map(st => 
            st.id === subtaskId ? { ...st, completed: !st.completed } : st
        );
        
        const allSubtasksCompleted = updatedSubtasks.every(st => st.completed);

        const updatedTaskData: Partial<Task> = {
            subtasks: updatedSubtasks,
            completed: allSubtasksCompleted,
            completedAt: allSubtasksCompleted ? new Date().toISOString() : null,
        };

        await updateDoc(taskRef, updatedTaskData as any);
    }
}

export async function deleteSubtask(taskId: string, subtaskId: string): Promise<void> {
    const taskRef = doc(db, TASKS_COLLECTION, taskId);
    const taskSnap = await getDoc(taskRef);
    if(taskSnap.exists()){
        const taskData = taskSnap.data() as Task;
        const updatedSubtasks = (taskData.subtasks || []).filter(st => st.id !== subtaskId);
        
        const allSubtasksCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every(st => st.completed);

        const updatedTaskData: Partial<Task> = {
            subtasks: updatedSubtasks,
            completed: allSubtasksCompleted,
            completedAt: allSubtasksCompleted ? new Date().toISOString() : null,
        };

        await updateDoc(taskRef, updatedTaskData as any);
    }
}


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
