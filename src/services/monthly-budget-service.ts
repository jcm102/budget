
'use server';

import { db } from '@/lib/firebase';
import type { MonthlyBudgetItem, Transaction } from '@/types';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  getDoc,
  query,
  where,
  orderBy,
} from 'firebase/firestore';

const BUDGET_ITEMS_COLLECTION = 'monthly-budget-items';
const TRANSACTIONS_COLLECTION = 'transactions';

// ===== Budget Items =====

export async function getBudgetForMonth(month: string): Promise<MonthlyBudgetItem[]> {
  const q = query(collection(db, BUDGET_ITEMS_COLLECTION), where('month', '==', month));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MonthlyBudgetItem));
}

export async function addBudgetItem(itemData: Omit<MonthlyBudgetItem, 'id'>): Promise<MonthlyBudgetItem> {
  const budgeted = itemData.breakdown?.reduce((sum, item) => sum + item.amount, 0) || itemData.budgeted || 0;
  const dataToSave = { ...itemData, budgeted };

  const docRef = await addDoc(collection(db, BUDGET_ITEMS_COLLECTION), dataToSave);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<MonthlyBudgetItem, 'id'>) };
}

export async function updateBudgetItem(id: string, itemData: Partial<Omit<MonthlyBudgetItem, 'id'>>): Promise<void> {
  const itemRef = doc(db, BUDGET_ITEMS_COLLECTION, id);
  let dataToUpdate = { ...itemData };

  if (itemData.breakdown) {
    const totalBudgeted = itemData.breakdown.reduce((sum, item) => sum + item.amount, 0);
    dataToUpdate.budgeted = totalBudgeted;
  }
  
  await updateDoc(itemRef, dataToUpdate);
}

// ===== Transactions =====

export async function getTransactionsForMonth(month: string): Promise<Transaction[]> {
  const startDate = new Date(`${month}-01T00:00:00.000Z`);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
  
  const q = query(
    collection(db, TRANSACTIONS_COLLECTION), 
    where('date', '>=', startDate.toISOString()),
    where('date', '<', endDate.toISOString()),
    orderBy('date', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
}

export async function addTransaction(transactionData: Omit<Transaction, 'id'>): Promise<Transaction> {
  const docRef = await addDoc(collection(db, TRANSACTIONS_COLLECTION), transactionData);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<Transaction, 'id'>) };
}
