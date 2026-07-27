'use server';

import { db } from '@/lib/firebase-admin';
import type { Goal } from '@/types';

const GOAL_COLLECTION = 'goals';

export async function getGoals(accountId: string): Promise<Goal[]> {
  let query = db.collection(GOAL_COLLECTION);
  if (accountId !== 'all') {
    query = query.where('accountId', '==', accountId) as any;
  }
  const querySnapshot = await query.get();
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
  const docRef = await db.collection(GOAL_COLLECTION).add(dataWithDefaults);
  const docSnap = await docRef.get();
  return { id: docSnap.id, ...(docSnap.data() as Omit<Goal, 'id'>) };
}

export async function updateGoal(id: string, itemData: Partial<Omit<Goal, 'id'>>): Promise<void> {
  await db.collection(GOAL_COLLECTION).doc(id).update(itemData);
}

export async function addToGoal(id: string, amount: number): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const goalRef = db.collection(GOAL_COLLECTION).doc(id);
    const goalDoc = await transaction.get(goalRef);
    if (!goalDoc.exists) {
      throw new Error('Goal document does not exist!');
    }
    const currentAmount = goalDoc.data()?.amount || 0;
    transaction.update(goalRef, { amount: currentAmount + amount });
  });
}

export async function deleteGoal(id: string): Promise<void> {
  await db.collection(GOAL_COLLECTION).doc(id).delete();
}
