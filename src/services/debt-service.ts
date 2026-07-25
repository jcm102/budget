'use server';

import { db } from '@/lib/firebase-admin';
import type { DebtItem } from '@/types';

const COLLECTION = 'debts';

export async function getDebts(accountId: string): Promise<DebtItem[]> {
  try {
    const snapshot = await db.collection(COLLECTION)
      .where('accountId', '==', accountId)
      .get();
      
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as DebtItem));
  } catch (error) {
    console.error('Error fetching debts:', error);
    return [];
  }
}

export async function addDebt(debtData: Partial<DebtItem>): Promise<void> {
  await db.collection(COLLECTION).add(debtData);
}

export async function updateDebt(id: string, data: Partial<DebtItem>): Promise<void> {
  await db.collection(COLLECTION).doc(id).update(data);
}

export async function deleteDebt(id: string): Promise<void> {
  await db.collection(COLLECTION).doc(id).delete();
}