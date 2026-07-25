'use server';

import { db } from '@/lib/firebase-admin';
import type { SavingsItem, SinkingFundTransaction } from '@/types';

const SAVINGS_COLLECTION = 'sinking-funds';
const TRANSACTIONS_COLLECTION = 'sinking-fund-transactions';

export async function getSavingsItems(accountId: string): Promise<SavingsItem[]> {
  try {
    const snapshot = await db.collection(SAVINGS_COLLECTION)
      .where('accountId', '==', accountId)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavingsItem));
  } catch (error) {
    console.error('Error fetching savings items:', error);
    return [];
  }
}

export async function addSavingsItem(itemData: any): Promise<void> {
  await db.collection(SAVINGS_COLLECTION).add({
    ...itemData,
    createdAt: new Date().toISOString()
  });
}

export async function updateSavingsItem(id: string, data: Partial<SavingsItem>): Promise<void> {
  await db.collection(SAVINGS_COLLECTION).doc(id).update(data);
}

export async function deleteSavingsItem(id: string): Promise<void> {
  await db.collection(SAVINGS_COLLECTION).doc(id).delete();
}

export async function fundSinkingFund(fundId: string, amount: number, notes: string): Promise<void> {
  const fundRef = db.collection(SAVINGS_COLLECTION).doc(fundId);
  const logRef = db.collection(TRANSACTIONS_COLLECTION).doc();

  await db.runTransaction(async (transaction) => {
    const fundDoc = await transaction.get(fundRef);
    if (!fundDoc.exists) throw new Error("Fund not found");
    const currentAmount = fundDoc.data()?.amount || 0;
    
    transaction.update(fundRef, { amount: currentAmount + amount });
    transaction.set(logRef, {
      fundId,
      amount,
      type: 'deposit',
      notes,
      date: new Date().toISOString(),
    });
  });
}

export async function withdrawFromSinkingFund(fundId: string, amount: number, notes: string): Promise<void> {
  const fundRef = db.collection(SAVINGS_COLLECTION).doc(fundId);
  const logRef = db.collection(TRANSACTIONS_COLLECTION).doc();

  await db.runTransaction(async (transaction) => {
    const fundDoc = await transaction.get(fundRef);
    if (!fundDoc.exists) throw new Error("Fund not found");
    const currentAmount = fundDoc.data()?.amount || 0;
    
    transaction.update(fundRef, { amount: currentAmount - amount });
    transaction.set(logRef, {
      fundId,
      amount,
      type: 'withdraw',
      notes,
      date: new Date().toISOString(),
    });
  });
}

export async function resetSinkingFund(fundId: string): Promise<void> {
  await db.collection(SAVINGS_COLLECTION).doc(fundId).update({ amount: 0 });
}

export async function transferSinkingFund(fromId: string, toId: string, amount: number): Promise<void> {
  const fromRef = db.collection(SAVINGS_COLLECTION).doc(fromId);
  const toRef = db.collection(SAVINGS_COLLECTION).doc(toId);

  await db.runTransaction(async (transaction) => {
    const fromDoc = await transaction.get(fromRef);
    const toDoc = await transaction.get(toRef);
    
    transaction.update(fromRef, { amount: (fromDoc.data()?.amount || 0) - amount });
    transaction.update(toRef, { amount: (toDoc.data()?.amount || 0) + amount });
  });
}