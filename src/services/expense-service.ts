
'use server';

import { db } from '@/lib/firebase';
import type { Expense, MileageLog } from '@/types';
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
    // To handle old data, we fetch docs where status is 'active' OR where the status field doesn't exist yet.
    const activeQuery = query(expenseCollection, where('type', '==', 'Monetary'), where('status', '==', 'active'));
    const legacyQuery = query(expenseCollection, where('type', '==', 'Monetary'), where('status', '==', null));
    
    const [activeSnapshot, legacySnapshot] = await Promise.all([
        getDocs(activeQuery),
        getDocs(legacyQuery)
    ]);
    
    const allItems = [
        ...activeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)),
        ...legacySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense))
    ];

    // Deduplicate in case an item somehow matches both (unlikely but safe)
    const uniqueItems = Array.from(new Map(allItems.map(item => [item.id, item])).values());
    return uniqueItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
  } else {
    q = query(expenseCollection, where('type', '==', 'Monetary'), where('status', '==', 'archived'), where('archiveKey', '==', archiveKey));
    const querySnapshot = await getDocs(q);
    const allItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
    return allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export async function addExpense(itemData: Omit<Expense, 'id'>): Promise<Expense> {
  // New expenses are always active
  const dataWithStatus = { ...itemData, status: 'active' };
  const docRef = await addDoc(collection(db, EXPENSE_COLLECTION), dataWithStatus);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...docSnap.data() } as Expense;
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


export async function deleteExpense(id: string): Promise<void> {
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

export async function getExpensesForMonth(archiveKey: string): Promise<{ expenses: Expense[], mileageLogs: MileageLog[] }> {
  const expenses = await getExpenses('archived', archiveKey);

  const mileageQuery = query(collection(db, EXPENSE_COLLECTION), where('type', '==', 'Mileage'), where('status', '==', 'archived'), where('archiveKey', '==', archiveKey));
  const mileageSnapshot = await getDocs(mileageQuery);
  const mileageLogs = mileageSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MileageLog))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return { expenses, mileageLogs };
}

export async function archiveCurrentExpenses(archiveKey: string): Promise<void> {
  const batch = writeBatch(db);
  
  // Query for all active and legacy (status=null) expenses and mileage logs
  const activeQuery = query(collection(db, EXPENSE_COLLECTION), where('status', '==', 'active'));
  const legacyQuery = query(collection(db, EXPENSE_COLLECTION), where('status', '==', null));

  const [activeSnapshot, legacySnapshot] = await Promise.all([
    getDocs(activeQuery),
    getDocs(legacyQuery)
  ]);
  
  const allDocsToArchive = [...activeSnapshot.docs, ...legacySnapshot.docs];

  if (allDocsToArchive.length === 0) {
    throw new Error("No active expenses to archive.");
  }
  
  allDocsToArchive.forEach(doc => {
    const docRef = doc.ref;
    batch.update(docRef, { status: 'archived', archiveKey: archiveKey });
  });
  
  await batch.commit();
}
