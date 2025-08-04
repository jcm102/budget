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
} from 'firebase/firestore';
import { isSameMonth, startOfMonth, getDate, getMonth, getYear, set, addWeeks, getWeek, differenceInWeeks, isSameDay } from 'date-fns';

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
    
    // Skip if item starts after the current month ends
    if (getYear(itemStartDate) > getYear(today) || (getYear(itemStartDate) === getYear(today) && getMonth(itemStartDate) > getMonth(today))) {
        return;
    }

    if (item.frequency === 'One-Time') {
      if (isSameMonth(itemStartDate, today)) {
        currentMonthItems.push(item);
      }
    } else if (item.frequency === 'Monthly') {
      if (itemStartDate <= today || isSameMonth(itemStartDate, today)) {
        const itemDay = getDate(itemStartDate);
        const currentMonthInstanceDate = set(today, { 
            setDate: itemDay,
            setHours: itemStartDate.getHours(),
            setMinutes: itemStartDate.getMinutes(),
            setSeconds: itemStartDate.getSeconds(),
            setMilliseconds: itemStartDate.getMilliseconds()
        });

        if (getMonth(currentMonthInstanceDate) === getMonth(today) && (getYear(currentMonthInstanceDate) > getYear(itemStartDate) || 
            (getYear(currentMonthInstanceDate) === getYear(itemStartDate) && getMonth(currentMonthInstanceDate) >= getMonth(itemStartDate))))
         {
            currentMonthItems.push({
                ...item,
                date: currentMonthInstanceDate.toISOString(),
            });
        }
      }
    } else if (item.frequency === 'Weekly' || item.frequency === 'Bi-Weekly') {
      let currentDate = itemStartDate;
      const increment = item.frequency === 'Weekly' ? 1 : 2;

      while (currentDate < startOfCurrentMonth) {
        currentDate = addWeeks(currentDate, increment);
      }

      while (isSameMonth(currentDate, today) || isSameDay(currentDate, today)) {
          if (getYear(currentDate) > getYear(itemStartDate) || (getYear(currentDate) === getYear(itemStartDate) && getMonth(currentDate) >= getMonth(itemStartDate))) {
              currentMonthItems.push({
                  ...item,
                  date: currentDate.toISOString()
              });
          }
          currentDate = addWeeks(currentDate, increment);
      }
    }
  });

  return currentMonthItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
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
