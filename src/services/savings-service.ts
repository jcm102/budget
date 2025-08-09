
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
import { addMonths, differenceInMonths } from 'date-fns';

const SAVINGS_COLLECTION = 'savings-items';

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

export async function updateAllSavingsItems(items: SavingsItem[]): Promise<void> {
    const batch = writeBatch(db);
    items.forEach(item => {
        const itemRef = doc(db, SAVINGS_COLLECTION, item.id);
        batch.update(itemRef, { totalBudgeted: item.totalBudgeted });
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
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const costBasis = item.isSplit ? item.cost / 2 : item.cost;
  
  const yearsMap = {
    'Semi-Annually': 0.5, 'Annually': 1, 'Every 2 Years': 2, 'Every 3 Years': 3, 'Every 4 Years': 4, 'Every 5 Years': 5
  };
  const purchaseIntervalYears = yearsMap[item.purchaseFrequency];
  const purchaseIntervalMonths = purchaseIntervalYears * 12;

  let nextRenewalDate = new Date(item.renewalDate);
  nextRenewalDate.setHours(0,0,0,0);

  let cycles = 0;
  let tempRenewalDate = new Date(nextRenewalDate);
  
  while (tempRenewalDate < now) {
    tempRenewalDate = addMonths(tempRenewalDate, purchaseIntervalMonths);
    cycles++;
  }

  const budgetedCost = costBasis * Math.pow(1 + (item.annualIncrease / 100), cycles);

  const newTotalBudgeted = item.totalBudgeted - budgetedCost;
  const newRenewalDate = addMonths(tempRenewalDate, purchaseIntervalMonths);

  await updateDoc(itemRef, {
    totalBudgeted: newTotalBudgeted,
    renewalDate: newRenewalDate.toISOString(),
  });
}
