
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
} from 'firebase/firestore';
import { isSameMonth, startOfMonth, addWeeks, addMonths, isBefore, isAfter, startOfDay } from 'date-fns';

const EXPENSE_COLLECTION = 'expenses';

export async function getExpenses(): Promise<Expense[]> {
  const expenseCollection = collection(db, EXPENSE_COLLECTION);
  const q = query(expenseCollection, where('type', '==', 'Monetary'));
  const querySnapshot = await getDocs(q);

  const today = new Date();
  const currentMonthItems: Expense[] = [];
  const startOfCurrentMonth = startOfMonth(today);
  const processedRecurringInstances = new Set<string>();

  const allItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));

  const modifiedItemsInMonth = allItems.filter(item => 
      item.originalId && isSameMonth(new Date(item.date), today)
  );

  modifiedItemsInMonth.forEach(item => {
      currentMonthItems.push(item);
      if (item.originalId) {
          processedRecurringInstances.add(item.originalId);
      }
  });

  allItems.forEach(item => {
    if (item.originalId) return;

    if (item.completed === undefined) {
      item.completed = false;
    }

    const itemStartDate = new Date(item.date);
    
    if (item.frequency === 'One-Time') {
      if (isSameMonth(itemStartDate, today) && !currentMonthItems.some(i => i.id === item.id)) {
        currentMonthItems.push(item);
      }
    } else if (item.frequency === 'Monthly') {
        let currentDate = startOfDay(itemStartDate);
        while (isBefore(currentDate, startOfCurrentMonth)) {
             currentDate = addMonths(currentDate, 1);
        }

        if (isSameMonth(currentDate, today)) {
            const instanceId = `${item.id}-${currentDate.getTime()}`;
             if (!processedRecurringInstances.has(instanceId)) {
                currentMonthItems.push({
                    ...item,
                    id: instanceId,
                    date: currentDate.toISOString(),
                    completed: item.completed || false
                });
            }
        }
    } else if (item.frequency === 'Weekly' || item.frequency === 'Bi-Weekly') {
      let currentDate = itemStartDate;
      const increment = item.frequency === 'Weekly' ? 1 : 2;

      while (isBefore(currentDate, startOfCurrentMonth)) {
        currentDate = addWeeks(currentDate, increment);
      }
      
      while (isSameMonth(currentDate, today)) {
          const instanceId = `${item.id}-${currentDate.getTime()}`;
          if (isAfter(currentDate, itemStartDate) || isSameMonth(itemStartDate, currentDate)) {
              if (!processedRecurringInstances.has(instanceId)) {
                currentMonthItems.push({
                    ...item,
                    id: instanceId, 
                    date: currentDate.toISOString(),
                    completed: item.completed || false
                });
              }
          }
          currentDate = addWeeks(currentDate, increment);
      }
    }
  });

  return currentMonthItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
