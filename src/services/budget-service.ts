
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

  const allItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetItem));

  allItems.forEach(item => {
    // Initialize completed if it's undefined
    if (item.completed === undefined) {
      item.completed = false;
    }

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
            if (modifiedInstance) {
                // if a modified one exists, show that instead.
                if (isSameMonth(new Date(modifiedInstance.date), today)) {
                    currentMonthItems.push(modifiedInstance);
                }
            } else {
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
          if (isAfter(currentDate, itemStartDate) || isSameMonth(itemStartDate, currentDate)) {
              const instanceId = `${item.id}-${currentDate.getTime()}`;
              const modifiedInstance = allItems.find(i => i.originalId === instanceId);
               if (modifiedInstance) {
                  if(isSameMonth(new Date(modifiedInstance.date), today)) {
                      currentMonthItems.push(modifiedInstance);
                  }
              } else {
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
            
            // if we are only toggling completion, handle it differently
            if ('completed' in itemData && Object.keys(itemData).length === 1) {
                 const newDocData: BudgetItem = {
                    ...(originalItemData as BudgetItem),
                    ...itemData,
                    id: id,
                    date: new Date(parseInt(id.split('-')[1])).toISOString(),
                    frequency: 'One-Time', 
                    originalId: id, 
                 };
                 await addDoc(collection(db, BUDGET_COLLECTION), newDocData);

            } else {
                 const newDocData: Omit<BudgetItem, 'id'> & { originalId: string } = {
                    ...(originalItemData as BudgetItem),
                    ...itemData,
                    frequency: 'One-Time', 
                    originalId: id,
                    completed: itemData.completed ?? false,
                };
                await addDoc(collection(db, BUDGET_COLLECTION), newDocData);
            }
        }
    } else {
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

  const q = query(collection(db, BUDGET_COLLECTION), where('originalId', '>=', baseId), where('originalId', '<', baseId + 'z'));
  const querySnapshot = await getDocs(q);
  querySnapshot.forEach(doc => {
      batch.delete(doc.ref);
  });
  
  const docSnap = await getDoc(itemRef);
  if (docSnap.exists()) {
    batch.delete(itemRef);
  }

  await batch.commit();
}
