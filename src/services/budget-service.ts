
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
  updateDoc,
} from 'firebase/firestore';
import { isSameMonth, startOfMonth, getDate, getMonth, getYear, set, addWeeks, isAfter, isBefore, isLastDayOfMonth, lastDayOfMonth, addMonths, startOfDay } from 'date-fns';

const BUDGET_COLLECTION = 'budget-items';

export async function getBudgetItems(): Promise<BudgetItem[]> {
  const budgetCollection = collection(db, BUDGET_COLLECTION);
  const q = query(budgetCollection);
  const querySnapshot = await getDocs(q);
  
  const today = new Date();
  const currentMonthItems: BudgetItem[] = [];
  const startOfCurrentMonth = startOfMonth(today);
  const processedRecurringInstances = new Set<string>();

  const allItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetItem));

  // First, find all modified one-time items for the current month
  const modifiedItemsInMonth = allItems.filter(item => 
      item.originalId && isSameMonth(new Date(item.date), today)
  );

  modifiedItemsInMonth.forEach(item => {
      currentMonthItems.push(item);
      // Keep track of which original instances have been processed
      if (item.originalId) {
          processedRecurringInstances.add(item.originalId);
      }
  });


  allItems.forEach(item => {
    // Skip modified items as they are already handled
    if (item.originalId) return;

    // Initialize completed if it's undefined
    if (item.completed === undefined) {
      item.completed = false;
    }

    const itemStartDate = new Date(item.date);
    
    // Skip items that start in a future month (unless it's a one-time item in the current month)
     if (getYear(itemStartDate) > getYear(today) || (getYear(itemStartDate) === getYear(today) && getMonth(itemStartDate) > getMonth(today))) {
        if (item.frequency === 'One-Time' && isSameMonth(itemStartDate, today)) {
          // continue
        } else {
          return;
        }
    }


    if (item.frequency === 'One-Time') {
      if (isSameMonth(itemStartDate, today) && !currentMonthItems.some(i => i.id === item.id)) {
        currentMonthItems.push(item);
      }
    } else if (item.frequency === 'Monthly') {
        let currentDate = startOfDay(itemStartDate);
        
        while (getMonth(currentDate) < getMonth(startOfCurrentMonth) && getYear(currentDate) <= getYear(today)) {
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

      // Fast-forward to the current month
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

export async function addBudgetItem(itemData: Omit<BudgetItem, 'id'>): Promise<BudgetItem> {
  const dataWithCompleted = { ...itemData, completed: false };
  const docRef = await addDoc(collection(db, BUDGET_COLLECTION), dataWithCompleted);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<BudgetItem, 'id'>) };
}

export async function updateBudgetItem(id: string, itemData: Partial<Omit<BudgetItem, 'id' | 'originalId'>>): Promise<void> {
    const isRecurringInstance = id.includes('-');
    
    if (isRecurringInstance) {
        const [baseId] = id.split('-');
        const originalItemRef = doc(db, BUDGET_COLLECTION, baseId);
        const originalItemSnap = await getDoc(originalItemRef);

        if (originalItemSnap.exists()) {
            const originalItemData = originalItemSnap.data();

            // Check if an overridden item already exists for this instance
            const q = query(collection(db, BUDGET_COLLECTION), where('originalId', '==', id));
            const existingOverrideSnap = await getDocs(q);

            if (!existingOverrideSnap.empty) {
                // Update the existing override document
                const overrideDocRef = existingOverrideSnap.docs[0].ref;
                await updateDoc(overrideDocRef, itemData);
            } else {
                // Create a new override document
                const newDocData: Omit<BudgetItem, 'id'> & { originalId: string } = {
                    ...(originalItemData as BudgetItem),
                    ...itemData,
                    frequency: 'One-Time', 
                    originalId: id,
                    date: new Date(parseInt(id.split('-')[1])).toISOString(),
                    completed: itemData.completed ?? false,
                };
                // Ensure the date from the edited item is used if provided
                if (itemData.date) {
                    newDocData.date = itemData.date;
                }
                await addDoc(collection(db, BUDGET_COLLECTION), newDocData);
            }
        }
    } else {
        // This is a base item or a one-off item
        const itemRef = doc(db, BUDGET_COLLECTION, id);
        const docSnap = await getDoc(itemRef);
        if (docSnap.exists()) {
            await updateDoc(itemRef, itemData);
        } else {
            throw new Error(`Budget item with id ${id} not found.`);
        }
    }
}

export async function deleteBudgetItem(id: string): Promise<void> {
  const isRecurringInstance = id.includes('-');
  
  if (isRecurringInstance) {
    // This is a virtual instance, we only need to delete the modified one-time items if they exist.
     const q = query(collection(db, BUDGET_COLLECTION), where('originalId', '==', id));
     const querySnapshot = await getDocs(q);
     if (!querySnapshot.empty) {
         await deleteDoc(querySnapshot.docs[0].ref);
     }
     // If no modified version exists, there's nothing in the DB to delete for this instance.
     return;
  }
  
  // It's a base item. Delete it and all its modified instances.
  const baseId = id;
  const itemRef = doc(db, BUDGET_COLLECTION, baseId);
  
  const batch = writeBatch(db);

  // This query is too broad, it can delete other items' instances.
  // We need to be more specific. Let's find docs where originalId starts with baseId.
  const q = query(collection(db, BUDGET_COLLECTION), where('originalId', '>=', baseId + '-'), where('originalId', '<', baseId + '-z'));

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
