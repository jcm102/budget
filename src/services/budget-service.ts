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
} from 'firebase/firestore';
import { isSameMonth, startOfMonth, getDate, getMonth, getYear, set, addWeeks, isAfter, isLastDayOfMonth, lastDayOfMonth } from 'date-fns';

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
    // When creating a Date object from an ISO string, it correctly handles the timezone offset.
    const itemStartDate = new Date(item.date);
    
    // Skip if item starts after the current month ends
    if (getYear(itemStartDate) > getYear(today) || (getYear(itemStartDate) === getYear(today) && getMonth(itemStartDate) > getMonth(today))) {
        // But include one-time items that were moved into this month from a future recurring item
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
       if (itemStartDate <= today || isSameMonth(itemStartDate, today)) {
        const itemIsLastDayOfMonth = isLastDayOfMonth(itemStartDate);

        let currentMonthInstanceDate;

        if (itemIsLastDayOfMonth) {
            currentMonthInstanceDate = set(lastDayOfMonth(today), {
                setHours: itemStartDate.getHours(),
                setMinutes: itemStartDate.getMinutes(),
                setSeconds: itemStartDate.getSeconds(),
                setMilliseconds: itemStartDate.getMilliseconds()
            });
        } else {
            const itemDay = getDate(itemStartDate);
            currentMonthInstanceDate = set(today, { 
                setDate: itemDay,
                setHours: itemStartDate.getHours(),
                setMinutes: itemStartDate.getMinutes(),
                setSeconds: itemStartDate.getSeconds(),
                setMilliseconds: itemStartDate.getMilliseconds()
            });
        }

        if (getMonth(currentMonthInstanceDate) === getMonth(today) && (isAfter(currentMonthInstanceDate, itemStartDate) || isSameMonth(itemStartDate, currentMonthInstanceDate)))
         {
            const instanceId = `${item.id}-${currentMonthInstanceDate.getTime()}`;
            // Check if this specific instance has been modified and stored as a one-time event
            const modifiedInstance = allItems.find(i => i.originalId === instanceId);
            if (!modifiedInstance) {
                currentMonthItems.push({
                    ...item,
                    id: instanceId,
                    date: currentMonthInstanceDate.toISOString(),
                });
            }
        }
      }
    } else if (item.frequency === 'Weekly' || item.frequency === 'Bi-Weekly') {
      let currentDate = itemStartDate;
      const increment = item.frequency === 'Weekly' ? 1 : 2;

      while (currentDate < startOfCurrentMonth) {
        currentDate = addWeeks(currentDate, increment);
      }
      
      while (isSameMonth(currentDate, today)) {
          if (isAfter(currentDate, itemStartDate) || isSameMonth(itemStartDate, currentDate)) {
              const instanceId = `${item.id}-${currentDate.getTime()}`;
              // Check if this specific instance has been modified and stored as a one-time event
              const modifiedInstance = allItems.find(i => i.originalId === instanceId);
              if (!modifiedInstance) {
                currentMonthItems.push({
                    ...item,
                    id: instanceId, // Create unique ID for each instance
                    date: currentDate.toISOString()
                });
              }
          }
          currentDate = addWeeks(currentDate, increment);
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
        // This is an edit of a recurring instance. Create a new one-time item instead of updating the original.
        const newDocData: Omit<BudgetItem, 'id'> = {
            ...itemData,
            frequency: 'One-Time', // It's now a specific, non-recurring event
            originalId: id, // Keep track of its origin
        };
        await addDoc(collection(db, BUDGET_COLLECTION), newDocData);
    } else {
        // This is a normal update for a one-time item or the base of a recurring item.
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
   // For recurring items, the ID might have a timestamp. We only need the base ID.
  const baseId = id.split('-')[0];
  const itemRef = doc(db, BUDGET_COLLECTION, baseId);
  
  // Also need to delete any modified one-time instances that point to this recurring item
  const q = query(collection(db, BUDGET_COLLECTION), where('originalId', '==', id));
  const querySnapshot = await getDocs(q);
  const batch = db.batch();

  querySnapshot.forEach(doc => {
      batch.delete(doc.ref);
  });
  
  batch.delete(itemRef);

  await batch.commit();
}