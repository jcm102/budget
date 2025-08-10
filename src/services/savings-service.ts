
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
import { addMonths, isBefore, getYear, getMonth, startOfDay } from 'date-fns';

const SAVINGS_COLLECTION = 'savings-items';
const yearsMap = {
  'Semi-Annually': 0.5, 'Annually': 1, 'Every 2 Years': 2, 'Every 3 Years': 3, 'Every 4 Years': 4, 'Every 5 Years': 5
};

// This helper function will contain the calculation logic and can be reused.
function calculateSavingsValues(item: SavingsItem) {
    const now = startOfDay(new Date());
    const costBasis = item.isSplit ? item.cost / 2 : item.cost;
    const purchaseIntervalYears = yearsMap[item.purchaseFrequency];
    const purchaseIntervalMonths = purchaseIntervalYears * 12;

    let nextRenewalDate = startOfDay(new Date(item.renewalDate));
    
    let cycles = 0;
    while (isBefore(nextRenewalDate, now)) {
      nextRenewalDate = addMonths(nextRenewalDate, purchaseIntervalMonths);
      cycles++;
    }
    
    const budgetedCost = costBasis * Math.pow(1 + (item.annualIncrease / 100), cycles * purchaseIntervalYears);
    
    const currentYear = getYear(now);
    const currentMonth = getMonth(now);
    const renewalYear = getYear(nextRenewalDate);
    const renewalMonth = getMonth(nextRenewalDate);
    
    let monthsRemaining = (renewalYear - currentYear) * 12 + (renewalMonth - currentMonth);
    if (monthsRemaining < 0) {
        monthsRemaining = 0;
    }
    
    const savingsPeriods = monthsRemaining === 0 ? 1 : monthsRemaining;
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
  });
}
