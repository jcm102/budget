

'use server';

import { db } from '@/lib/firebase';
import type { SavingsItem, SavingsRecurrence } from '@/types';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  updateDoc,
  addDoc,
  getDoc,
  orderBy,
  where,
} from 'firebase/firestore';
import { addMonths } from 'date-fns';

const SAVINGS_COLLECTION = 'sinking-funds';

const recurrenceIntervalMap: Record<SavingsRecurrence, number> = {
    'None': 0,
    'Quarterly': 3,
    'Semi-Annually': 6,
    'Semi-Annually (Custom)': 6, // Base for custom logic
    'Annually': 12,
    'Bi-Annually': 24,
};


export async function getSavingsItems(accountId: string): Promise<SavingsItem[]> {
  const savingsCollection = collection(db, SAVINGS_COLLECTION);
  const q = query(savingsCollection, where('accountId', '==', accountId));
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavingsItem));
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function addSavingsItem(itemData: Omit<SavingsItem, 'id'>): Promise<SavingsItem> {
  const docRef = await addDoc(collection(db, SAVINGS_COLLECTION), itemData);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<SavingsItem, 'id'>) };
}

export async function updateSavingsItem(id: string, itemData: Partial<Omit<SavingsItem, 'id'>>): Promise<void> {
  const itemRef = doc(db, SAVINGS_COLLECTION, id);
  const docSnap = await getDoc(itemRef);

  if (!docSnap.exists()) {
    throw new Error('Savings item not found');
  }

  const existingData = docSnap.data() as SavingsItem;
  const wasWithdrawal = 'amount' in itemData && itemData.amount! < existingData.amount;

  // Check for reset condition
  if (
    wasWithdrawal &&
    existingData.recurrence &&
    existingData.recurrence !== 'None' &&
    existingData.dueDate
  ) {
    const savingsTarget = existingData.savingsTarget || existingData.totalCost || 0;
    const amountAfterWithdrawal = itemData.amount!;
    const amountWithdrawn = existingData.amount - amountAfterWithdrawal;

    // If they withdrew at least the target amount, reset the date.
    if (savingsTarget > 0 && amountWithdrawn >= savingsTarget) {
      if (existingData.recurrence === 'Semi-Annually (Custom)' && existingData.semiAnnualOffset) {
          const currentDueDate = new Date(existingData.dueDate);
          const year = currentDueDate.getFullYear();
          const firstPaymentMonth = currentDueDate.getMonth();
          const secondPaymentMonth = (firstPaymentMonth + existingData.semiAnnualOffset) % 12;

          let nextDueDate;
          if (currentDueDate.getMonth() === firstPaymentMonth) {
              // The withdrawal was for the first payment, set next due date to the second.
              nextDueDate = new Date(year, secondPaymentMonth, currentDueDate.getDate());
          } else {
              // The withdrawal was for the second payment, set next due date to the first payment of next year.
              nextDueDate = new Date(year + 1, firstPaymentMonth, currentDueDate.getDate());
          }
          itemData.dueDate = nextDueDate.toISOString();

      } else {
          const monthsToAdd = recurrenceIntervalMap[existingData.recurrence];
          if (monthsToAdd > 0) {
            const newDueDate = addMonths(new Date(existingData.dueDate), monthsToAdd);
            itemData.dueDate = newDueDate.toISOString();
          }
      }
      
      // The new amount will be whatever is left over after the large withdrawal.
      itemData.amount = existingData.amount - savingsTarget;
      if(itemData.amount < 0) itemData.amount = 0;
    }
  }

  // Firestore does not allow undefined values. We need to clean the object.
  const cleanItemData = Object.fromEntries(Object.entries(itemData).filter(([_, v]) => v !== undefined));
  await updateDoc(itemRef, cleanItemData);
}


export async function deleteSavingsItem(id: string): Promise<void> {
  const itemRef = doc(db, SAVINGS_COLLECTION, id);
  await deleteDoc(itemRef);
}
