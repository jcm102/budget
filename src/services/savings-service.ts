
'use server';

import { db } from '@/lib/firebase';
import type { SavingsItem } from '@/types';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  updateDoc,
  addDoc,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { addMonths, isBefore, getYear, getMonth, startOfDay, differenceInCalendarMonths } from 'date-fns';

const SAVINGS_COLLECTION = 'savings-items';
const yearsMap = {
  'Semi-Annually': 0.5, 'Annually': 1, 'Every 2 Years': 2, 'Every 3 Years': 3, 'Every 4 Years': 4, 'Every 5 Years': 5
};

function calculateNextRenewalDate(renewalDate: Date, frequency: keyof typeof yearsMap, now: Date): Date {
  const purchaseIntervalMonths = yearsMap[frequency] * 12;
  let nextRenewal = new Date(renewalDate);
  while (isBefore(nextRenewal, now)) {
      nextRenewal = addMonths(nextRenewal, purchaseIntervalMonths);
  }
  return nextRenewal;
}

// This helper function will contain the calculation logic and can be reused.
function calculateSavingsValues(item: SavingsItem) {
    const costBasis = item.isSplit ? item.cost / 2 : item.cost;
    const budgetedCost = costBasis * (1 + item.annualIncrease / 100);

    const now = startOfDay(new Date());
    const renewalDate = startOfDay(new Date(item.renewalDate));
    const nextRenewalDate = calculateNextRenewalDate(renewalDate, item.purchaseFrequency, now);
    
    let monthsRemaining = differenceInCalendarMonths(nextRenewalDate, now);

    const savingsPeriods = monthsRemaining <= 0 ? 1 : monthsRemaining;
    
    const amountToSave = budgetedCost - item.totalBudgeted;
    const monthlyCost = amountToSave > 0 && savingsPeriods > 0 ? amountToSave / savingsPeriods : 0;
    
    return { budgetedCost, monthlyCost, nextRenewalDate };
}


export async function getSavingsItems(): Promise<SavingsItem[]> {
  const savingsCollection = collection(db, SAVINGS_COLLECTION);
  const q = query(savingsCollection);
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavingsItem));
  return items.sort((a, b) => a.expense.localeCompare(b.expense));
}

export async function addSavingsItem(itemData: Omit<SavingsItem, 'id'>): Promise<SavingsItem> {
  const docRef = await addDoc(collection(db, SAVINGS_COLLECTION), itemData);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<SavingsItem, 'id'>) };
}

export async function updateSavingsItem(id: string, itemData: Partial<Omit<SavingsItem, 'id'>>): Promise<void> {
  const itemRef = doc(db, SAVINGS_COLLECTION, id);
  await updateDoc(itemRef, itemData);
}

export async function deleteSavingsItem(id: string): Promise<void> {
  const itemRef = doc(db, SAVINGS_COLLECTION, id);
  await deleteDoc(itemRef);
}

export async function processMonthlySavingsForAllItems(): Promise<void> {
    const allItems = await getSavingsItems();
    const batch = writeBatch(db);

    allItems.forEach(item => {
        const { monthlyCost } = calculateSavingsValues(item);
        const newTotalBudgeted = item.totalBudgeted + monthlyCost;
        const itemRef = doc(db, SAVINGS_COLLECTION, item.id);
        batch.update(itemRef, { totalBudgeted: newTotalBudgeted });
    });

    await batch.commit();
}


export async function recordPurchase(itemId: string): Promise<void> {
  const itemRef = doc(db, SAVINGS_COLLECTION, itemId);
  const docSnap = await getDoc(itemRef);

  if (!docSnap.exists()) {
    throw new Error('Savings item not found');
  }

  const item = docSnap.data() as SavingsItem;
  const { budgetedCost, nextRenewalDate } = calculateSavingsValues(item);
  
  const purchaseIntervalMonths = yearsMap[item.purchaseFrequency] * 12;

  const newTotalBudgeted = item.totalBudgeted - budgetedCost;
  const newRenewalDate = addMonths(nextRenewalDate, purchaseIntervalMonths);

  await updateDoc(itemRef, {
    totalBudgeted: newTotalBudgeted > 0 ? newTotalBudgeted : 0,
    renewalDate: newRenewalDate.toISOString(),
    cost: budgetedCost, // Update the cost to the budgeted cost for the next cycle
  });
}

    