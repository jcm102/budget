'use server';

import { db } from '@/lib/firebase-admin';
import type { Account } from '@/types';

const COLLECTION = 'accounts';

export async function getAccounts(userId: string): Promise<Account[]> {
  try {
    const snapshot = await db.collection(COLLECTION)
      .where('userId', '==', userId)
      .get();
      
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Account));
  } catch (error) {
    console.error('Error fetching accounts:', error);
    return [];
  }
}

export async function addAccount(accountData: Partial<Account>): Promise<void> {
  await db.collection(COLLECTION).add({
    ...accountData,
    createdAt: new Date().toISOString()
  });
}

export async function updateAccount(id: string, data: Partial<Account>): Promise<void> {
  await db.collection(COLLECTION).doc(id).update(data);
}

export async function deleteAccount(id: string): Promise<void> {
  await db.collection(COLLECTION).doc(id).delete();
}