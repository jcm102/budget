
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
  addDoc,
  where,
} from 'firebase/firestore';

const EXPENSE_COLLECTION = 'expenses';

export async function getExpenses(): Promise<Expense[]> {
  const expenseCollection = collection(db, EXPENSE_COLLECTION);
  // Remove the orderBy clause to avoid needing a composite index
  const q = query(expenseCollection, where('type', '==', 'Monetary'));
  const querySnapshot = await getDocs(q);

  const expenses = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
  
  // Sort in-memory instead
  return expenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
