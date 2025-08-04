
'use server';

import { db } from '@/lib/firebase';
import type { Expense } from '@/types';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  getDoc,
  orderBy,
  addDoc,
  where,
} from 'firebase/firestore';

const EXPENSE_COLLECTION = 'expenses';

export async function getExpenses(): Promise<Expense[]> {
  const expenseCollection = collection(db, EXPENSE_COLLECTION);
  const q = query(expenseCollection, where('type', '==', 'Monetary'), orderBy('date', 'desc'));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
}

export async function addExpense(itemData: Omit<Expense, 'id'>): Promise<Expense> {
  const docRef = await addDoc(collection(db, EXPENSE_COLLECTION), itemData);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...docSnap.data() } as Expense;
}

export async function updateExpense(id: string, itemData: Omit<Expense, 'id'>): Promise<void> {
  const itemRef = doc(db, EXPENSE_COLLECTION, id);
  const docSnap = await getDoc(itemRef);
  if (docSnap.exists()) {
    const existingData = docSnap.data();
    await setDoc(itemRef, { ...existingData, ...itemData });
  } else {
    throw new Error(`Expense with id ${id} not found.`);
  }
}

export async function deleteExpense(id: string): Promise<void> {
  const itemRef = doc(db, EXPENSE_COLLECTION, id);
  await deleteDoc(itemRef);
}
