
'use server';

import { db } from '@/lib/firebase';
import type { Expense, MileageLog, Honorarium } from '@/types';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  getDoc,
  addDoc,
  where,
  writeBatch,
  orderBy,
} from 'firebase/firestore';

const EXPENSE_COLLECTION = 'expenses';

export async function getExpenses(status: 'active' | 'archived', archiveKey?: string): Promise<Expense[]> {
  const expenseCollection = collection(db, EXPENSE_COLLECTION);
  
  let q;
  if (status === 'active') {
    const activeQuery = query(expenseCollection, where('type', '==', 'Monetary'), where('status', '==', 'active'));
    
    const activeSnapshot = await getDocs(activeQuery);
    
    const allItems = activeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));

    return allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
  } else {
    q = query(expenseCollection, where('type', '==', 'Monetary'), where('status', '==', 'archived'), where('archiveKey', '==', archiveKey));
    const querySnapshot = await getDocs(q);
    const allItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
    return allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export async function getHonorariums(status: 'active' | 'archived', archiveKey?: string): Promise<Honorarium[]> {
  const expenseCollection = collection(db, EXPENSE_COLLECTION);
  let q;
  if (status === 'active') {
      q = query(expenseCollection, where('type', '==', 'Honorarium'), where('status', '==', 'active'));
  } else {
      q = query(expenseCollection, where('type', '==', 'Honorarium'), where('status', '==', 'archived'), where('archiveKey', '==', archiveKey));
  }
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Honorarium));
  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}


export async function addExpense(itemData: Omit<Expense, 'id'>): Promise<Expense> {
  const dataWithStatus = { ...itemData, status: 'active' };
  const docRef = await addDoc(collection(db, EXPENSE_COLLECTION), dataWithStatus);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...docSnap.data() } as Expense;
}

export async function addHonorarium(itemData: Omit<Honorarium, 'id'>): Promise<Honorarium> {
  const dataWithStatus = { ...itemData, status: 'active' };
  const docRef = await addDoc(collection(db, EXPENSE_COLLECTION), dataWithStatus);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...docSnap.data() } as Honorarium;
}

export async function updateExpense(id: string, itemData: Partial<Omit<Expense, 'id' | 'originalId'>>): Promise<void> {
    const itemRef = doc(db, EXPENSE_COLLECTION, id);
    const docSnap = await getDoc(itemRef);
    if (docSnap.exists()) {
        await updateDoc(itemRef, itemData);
    } else {
        throw new Error(`Expense with id ${id} not found.`);
    }
}

export async function updateHonorarium(id: string, itemData: Partial<Omit<Honorarium, 'id'>>): Promise<void> {
    const itemRef = doc(db, EXPENSE_COLLECTION, id);
    await updateDoc(itemRef, itemData);
}

export async function deleteExpense(id: string): Promise<void> {
  const itemRef = doc(db, EXPENSE_COLLECTION, id);
  await deleteDoc(itemRef);
}

export async function deleteHonorarium(id: string): Promise<void> {
  const itemRef = doc(db, EXPENSE_COLLECTION, id);
  await deleteDoc(itemRef);
}

// New functions for archiving
export async function getArchivedMonths(): Promise<string[]> {
  const q = query(collection(db, EXPENSE_COLLECTION), where('status', '==', 'archived'));
  const querySnapshot = await getDocs(q);
  const archiveKeys = new Set<string>();
  querySnapshot.forEach(doc => {
    const data = doc.data();
    if (data.archiveKey) {
      archiveKeys.add(data.archiveKey);
    }
  });
  return Array.from(archiveKeys).sort().reverse();
}

export async function getExpensesForMonth(archiveKey: string): Promise<{ expenses: Expense[], mileageLogs: MileageLog[], honorariums: Honorarium[] }> {
  const expenses = await getExpenses('archived', archiveKey);
  const honorariums = await getHonorariums('archived', archiveKey);

  const mileageQuery = query(collection(db, EXPENSE_COLLECTION), where('type', '==', 'Mileage'), where('status', '==', 'archived'), where('archiveKey', '==', archiveKey));
  const mileageSnapshot = await getDocs(mileageQuery);
  const mileageLogs = mileageSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MileageLog))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return { expenses, mileageLogs, honorariums };
}

export async function archiveCurrentExpenses(archiveKey: string): Promise<void> {
  const batch = writeBatch(db);
  
  const activeQuery = query(collection(db, EXPENSE_COLLECTION), where('status', '==', 'active'));

  const activeSnapshot = await getDocs(activeQuery);
  
  if (activeSnapshot.empty) {
    throw new Error("No active expenses to archive.");
  }
  
  activeSnapshot.forEach(doc => {
    const docRef = doc.ref;
    batch.update(docRef, { status: 'archived', archiveKey: archiveKey });
  });
  
  await batch.commit();
}
