'use server';

import { db } from '@/lib/firebase';
import type { BudgetItem } from '@/types';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc,
  query,
  getDoc
} from 'firebase/firestore';

const BUDGET_COLLECTION = 'budget-items';

export async function getBudgetItems(): Promise<BudgetItem[]> {
  const budgetCollection = collection(db, BUDGET_COLLECTION);
  const q = query(budgetCollection);
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetItem));
  return items;
}

export async function addBudgetItem(itemData: Omit<BudgetItem, 'id'>): Promise<BudgetItem> {
  const docRef = doc(collection(db, BUDGET_COLLECTION));
  await setDoc(docRef, itemData);
  return { ...itemData, id: docRef.id };
}

export async function updateBudgetItem(id: string, itemData: Omit<BudgetItem, 'id'>): Promise<void> {
  const itemRef = doc(db, BUDGET_COLLECTION, id);
  const docSnap = await getDoc(itemRef);
  if (docSnap.exists()) {
      const existingData = docSnap.data();
      await setDoc(itemRef, { ...existingData, ...itemData });
  } else {
      throw new Error(`Budget item with id ${id} not found.`);
  }
}

export async function deleteBudgetItem(id: string): Promise<void> {
  const itemRef = doc(db, BUDGET_COLLECTION, id);
  await deleteDoc(itemRef);
}
