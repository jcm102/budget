

'use server';

import { db } from '@/lib/firebase-admin';
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
  runTransaction,
  where,
} from 'firebase/firestore';

const GOAL_COLLECTION = 'goals';

export async function getGoals(accountId: string): Promise<Goal[]> {
  const goalCollection = collection(db, GOAL_COLLECTION);
  const q = query(goalCollection, where('accountId', '==', accountId));
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal));
  return items.sort((a, b) => a.name.localeCompare(b.name));
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

export async function addToGoal(id: string, amount: number): Promise<void> {
  const goalRef = doc(db, GOAL_COLLECTION, id);
  await runTransaction(db, async (transaction) => {
    const goalDoc = await transaction.get(goalRef);
    if (!goalDoc.exists()) {
      throw "Goal document does not exist!";
    }
    const currentAmount = goalDoc.data().amount || 0;
    const newAmount = currentAmount + amount;
    transaction.update(goalRef, { amount: newAmount });
  });
}

export async function deleteGoal(id: string): Promise<void> {
  const itemRef = doc(db, GOAL_COLLECTION, id);
  await deleteDoc(itemRef);
}
