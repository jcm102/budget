
'use server';

import { db } from '@/lib/firebase';
import type { AccountDetails } from '@/types';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  orderBy,
  addDoc,
  writeBatch,
  limit,
  updateDoc,
} from 'firebase/firestore';

const ACCOUNT_DETAILS_COLLECTION = 'transferees'; // Keeping the old collection name to avoid data loss
const defaultAccounts = [
    { name: 'Checking Account', type: 'Chequing', balance: 0 },
    { name: 'Savings Account', type: 'Savings', balance: 0 },
    { name: 'Credit Card', type: 'Credit', balance: 0 }
];

async function seedDefaultAccounts() {
  const accountCollectionRef = collection(db, ACCOUNT_DETAILS_COLLECTION);
  const q = query(accountCollectionRef, limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    const batch = writeBatch(db);
    defaultAccounts.forEach(account => {
      const newDocRef = doc(accountCollectionRef);
      batch.set(newDocRef, account);
    });
    await batch.commit();
  }
}

export async function getAccounts(): Promise<AccountDetails[]> {
  await seedDefaultAccounts();
  const accountCollection = collection(db, ACCOUNT_DETAILS_COLLECTION);
  const q = query(accountCollection, orderBy('name'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountDetails));
}

export async function addAccount(accountData: Omit<AccountDetails, 'id'>): Promise<AccountDetails> {
  const accountCollection = collection(db, ACCOUNT_DETAILS_COLLECTION);
  const docRef = await addDoc(accountCollection, accountData);
  return { id: docRef.id, ...accountData };
}

export async function updateAccount(id: string, accountData: Partial<Omit<AccountDetails, 'id'>>): Promise<void> {
    const accountRef = doc(db, ACCOUNT_DETAILS_COLLECTION, id);
    await updateDoc(accountRef, accountData);
}

export async function deleteAccount(id: string): Promise<void> {
  const accountRef = doc(db, ACCOUNT_DETAILS_COLLECTION, id);
  await deleteDoc(accountRef);
}
