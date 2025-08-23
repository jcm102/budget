
'use server';

import { db } from '@/lib/firebase';
import type { Goal } from '@/types';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  updateDoc,
  addDoc,
  getDoc,
  orderBy,
} from 'firebase/firestore';

const GOAL_COLLECTION = 'goals';

export async function getGoals(): Promise<Goal[]> {
  const goalCollection = collection(db, GOAL_COLLECTION);
  const q = query(goalCollection, orderBy('name'));
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal));
  return items;
}

export async function addGoal(itemData: Omit<Goal, 'id'>): Promise<Goal> {
  const dataWithDefaults = {
    ...itemData,
    amount: itemData.amount || 0,
    cost: itemData.cost || 0,
    link: itemData.link || null,
  };
  const docRef = await addDoc(collection(db, GOAL_COLLECTION), dataWithDefaults);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<Goal, 'id'>) };
}

export async function updateGoal(id: string, itemData: Partial<Omit<Goal, 'id'>>): Promise<void> {
  const itemRef = doc(db, GOAL_COLLECTION, id);
  await updateDoc(itemRef, itemData);
}

export async function deleteGoal(id: string): Promise<void> {
  const itemRef = doc(db, GOAL_COLLECTION, id);
  await deleteDoc(itemRef);
}
