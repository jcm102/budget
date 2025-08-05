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
  getDoc,
  addDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { isSameMonth, startOfMonth, getDate, getMonth, getYear, set, addWeeks, isAfter, isLastDayOfMonth, lastDayOfMonth, addMonths, startOfDay } from 'date-fns';

const BUDGET_COLLECTION = 'budget-items';

export async function getBudgetItems(): Promise<BudgetItem[]> {
  const budgetCollection = collection(db, BUDGET_COLLECTION);
  const q = query(budgetCollection);
  const querySnapshot = await getDocs(q);
  
  const today = new Date();
  const currentMonthItems: BudgetItem[] = [];
  const startOfCurrentMonth = startOfMonth(today);

  const allItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetItem));

  allItems.forEach(item => {
    const itemStartDate = new Date(item.date);
    
    if (getYear(itemStartDate) > getYear(today) || (getYear(itemStartDate) === getYear(today) && getMonth(itemStartDate) > getMonth(today))) {
        if (item.frequency === 'One-Time' && isSameMonth(itemStartDate, today)) {
          // continue
        } else {
          return;
        }
    }

    if (item.frequency === 'One-Time') {
      if (isSameMonth(itemStartDate, today)) {
        currentMonthItems.push(item);
      }
    } else if (item.frequency === 'Monthly') {
        let currentDate = startOfDay(itemStartDate);
        
        while (isBefore(currentDate, startOfCurrentMonth)) {
             currentDate = addMonths(currentDate, 1);
        }

        if (isSameMonth(currentDate, today)) {
            const instanceId = `${item.id}-${currentDate.getTime()}`;
            const modifiedInstance = allItems.find(i => i.originalId === instanceId);
            if (!modifiedInstance) {
                currentMonthItems.push({
                    ...item,
                    id: instanceId,
                    date: currentDate.toISOString(),
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
          if (isAfter(currentDate, itemStartDate) || isSameMonth(itemStartDate, currentDate)) {
              const instanceId = `${item.id}-${currentDate.getTime()}`;
              const modifiedInstance = allItems.find(i => i.originalId === instanceId);
              if (!modifiedInstance) {
                currentMonthItems.push({
                    ...item,
                    id: instanceId, 
                    date: currentDate.toISOString()
                });
              }
          }
          currentDate = addWeeks(currentDate, increment);
      }
    }
  });

  // Now, fetch any one-time items that might have been created from editing a recurring item from a *future* month
  const qModified = query(collection(db, BUDGET_COLLECTION), where('originalId', '!=', null));
  const modifiedSnapshot = await getDocs(qModified);
  modifiedSnapshot.forEach(doc => {
      const modifiedItem = { id: doc.id, ...doc.data() } as BudgetItem;
      if (isSameMonth(new Date(modifiedItem.date), today)) {
          // Avoid duplicates if it's already in the list
          if (!currentMonthItems.some(item => item.id === modifiedItem.id)) {
              currentMonthItems.push(modifiedItem);
          }
      }
  });


  return currentMonthItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function addBudgetItem(itemData: Omit<BudgetItem, 'id'>): Promise<BudgetItem> {
  const docRef = await addDoc(collection(db, BUDGET_COLLECTION), itemData);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<BudgetItem, 'id'>) };
}

export async function updateBudgetItem(id: string, itemData: Omit<BudgetItem, 'id' | 'originalId'>): Promise<void> {
    const isRecurringInstance = id.includes('-');
    
    if (isRecurringInstance) {
        const newDocData: Omit<BudgetItem, 'id'> & { originalId: string } = {
            ...itemData,
            frequency: 'One-Time', 
            originalId: id, 
        };
        await addDoc(collection(db, BUDGET_COLLECTION), newDocData);
    } else {
        const itemRef = doc(db, BUDGET_COLLECTION, id);
        const docSnap = await getDoc(itemRef);
        if (docSnap.exists()) {
            const existingData = docSnap.data();
            await setDoc(itemRef, { ...existingData, ...itemData });
        } else {
            throw new Error(`Budget item with id ${id} not found.`);
        }
    }
}

export async function deleteBudgetItem(id: string): Promise<void> {
  const baseId = id.split('-')[0];
  const itemRef = doc(db, BUDGET_COLLECTION, baseId);
  
  const batch = writeBatch(db);

  // Also need to delete any modified one-time instances that point to this recurring item
  const q = query(collection(db, BUDGET_COLLECTION), where('originalId', '==', id));
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach(doc => {
      batch.delete(doc.ref);
  });
  
  batch.delete(itemRef);

  await batch.commit();
}
