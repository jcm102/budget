
'use server';

import { db } from '@/lib/firebase';
import type { Expense } from '@/types';
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
import { isSameMonth, startOfMonth, addWeeks, addMonths, isBefore, isAfter, startOfDay } from 'date-fns';

const EXPENSE_COLLECTION = 'expenses';

export async function getExpenses(): Promise<Expense[]> {
  const expenseCollection = collection(db, EXPENSE_COLLECTION);
  // Fetch all monetary expenses and order them by date
  const q = query(
    expenseCollection, 
    where('type', '==', 'Monetary'),
    orderBy('date', 'desc')
  );
  const querySnapshot = await getDocs(q);

  const allItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
  
  // For now, we will return all monetary expenses. 
  // The complex logic for recurring items is being simplified to ensure all data is visible.
  // A future enhancement could be to re-introduce monthly recurring items with a clear UI.
  return allItems;
}


export async function addExpense(itemData: Omit<Expense, 'id'>): Promise<Expense> {
  const docRef = await addDoc(collection(db, EXPENSE_COLLECTION), itemData);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...docSnap.data() } as Expense;
}

export async function updateExpense(id: string, itemData: Partial<Omit<Expense, 'id' | 'originalId'>>): Promise<void> {
    const isRecurringInstance = id.includes('-');
    
    if (isRecurringInstance) {
        const [baseId] = id.split('-');
        const originalItemRef = doc(db, EXPENSE_COLLECTION, baseId);
        const originalItemSnap = await getDoc(originalItemRef);

        if (originalItemSnap.exists()) {
            const originalItemData = originalItemSnap.data();

            const q = query(collection(db, EXPENSE_COLLECTION), where('originalId', '==', id));
            const existingOverrideSnap = await getDocs(q);

            if (!existingOverrideSnap.empty) {
                const overrideDocRef = existingOverrideSnap.docs[0].ref;
                await updateDoc(overrideDocRef, itemData);
            } else {
                const newDocData: Omit<Expense, 'id'> & { originalId: string } = {
                    ...(originalItemData as Expense),
                    ...itemData,
                    frequency: 'One-Time', 
                    originalId: id,
                    date: new Date(parseInt(id.split('-')[1])).toISOString(),
                    completed: itemData.completed ?? false,
                };
                if (itemData.date) {
                    newDocData.date = itemData.date;
                }
                await addDoc(collection(db, EXPENSE_COLLECTION), newDocData);
            }
        }
    } else {
        const itemRef = doc(db, EXPENSE_COLLECTION, id);
        const docSnap = await getDoc(itemRef);
        if (docSnap.exists()) {
            await updateDoc(itemRef, itemData);
        } else {
            throw new Error(`Expense with id ${id} not found.`);
        }
    }
}


export async function deleteExpense(id: string): Promise<void> {
  const isRecurringInstance = id.includes('-');
  
  if (isRecurringInstance) {
     const q = query(collection(db, EXPENSE_COLLECTION), where('originalId', '==', id));
     const querySnapshot = await getDocs(q);
     if (!querySnapshot.empty) {
         await deleteDoc(querySnapshot.docs[0].ref);
     }
     return;
  }
  
  const baseId = id;
  const itemRef = doc(db, EXPENSE_COLLECTION, baseId);
  
  const batch = writeBatch(db);
  const q = query(collection(db, EXPENSE_COLLECTION), where('originalId', '>=', baseId + '-'), where('originalId', '<', baseId + '-z'));

  const querySnapshot = await getDocs(q);
  querySnapshot.forEach(doc => {
    if (doc.data().originalId.startsWith(baseId + '-')) {
      batch.delete(doc.ref);
    }
  });
  
  const docSnap = await getDoc(itemRef);
  if (docSnap.exists()) {
    batch.delete(itemRef);
  }

  await batch.commit();
}
