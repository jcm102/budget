

'use server';

import { db } from '@/lib/firebase';
import type { SavingsItem, SinkingFundTransaction } from '@/types';
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
  serverTimestamp,
  runTransaction
} from 'firebase/firestore';
import { startOfToday, parseISO, differenceInCalendarMonths, addMonths } from 'date-fns';

const SAVINGS_COLLECTION = 'sinking-funds';
const TRANSACTIONS_COLLECTION = 'sinking-fund-transactions';

const calculateMonthlyAmount = (item: SavingsItem): number => {
    const { amount, totalCost, recurrence, dueDate, isCustomGoal, goal } = item;
    
    if (isCustomGoal && goal) {
        return goal;
    }

    if (!totalCost || totalCost <= amount) return 0;

    const remainingAmount = totalCost - amount;
    
    if (dueDate) {
        const today = startOfToday();
        const due = parseISO(dueDate);
        
        if (due <= today) return remainingAmount;

        const totalMonths = (due.getFullYear() - today.getFullYear()) * 12 + (due.getMonth() - today.getMonth());
        
        // Exclude the current month from the savings period.
        const savingMonths = totalMonths -1;

        if (savingMonths <= 0) return remainingAmount;

        return remainingAmount / savingMonths;
    }

    // If no due date, fall back to recurrence-based calculation.
    if (recurrence && recurrence !== 'None') {
        switch (recurrence) {
            case 'Annually': return totalCost / 11;
            case 'Quarterly': return totalCost / 3;
            case 'Semi-Annually': return totalCost / 6;
            case 'Semi-Annually (Custom)': return totalCost / 6;
            default: return 0;
        }
    }
    
    return 0; // If no due date and no recurrence, it's a manual fund.
};


export async function getSavingsItems(accountId: string): Promise<SavingsItem[]> {
  const savingsCollection = collection(db, SAVINGS_COLLECTION);
  const q = query(savingsCollection, where('accountId', '==', accountId));
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => {
      const data = doc.data() as Omit<SavingsItem, 'id'>;
      const item = { id: doc.id, ...data };
      const monthlyAmount = calculateMonthlyAmount(item);
      return { ...item, monthlyAmount };
  });
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function addSavingsItem(itemData: Omit<SavingsItem, 'id' | 'monthlyAmount'>): Promise<SavingsItem> {
  const docRef = await addDoc(collection(db, SAVINGS_COLLECTION), itemData);
  const docSnap = await getDoc(docRef);
  const newItem = { id: docSnap.id, ...(docSnap.data() as Omit<SavingsItem, 'id'>) };
  return { ...newItem, monthlyAmount: calculateMonthlyAmount(newItem) };
}

export async function updateSavingsItem(id: string, itemData: Partial<Omit<SavingsItem, 'id' | 'monthlyAmount'>>): Promise<void> {
  const itemRef = doc(db, SAVINGS_COLLECTION, id);
  await updateDoc(itemRef, itemData);
}

export async function fundSinkingFund(fundId: string, amount: number, userId: string): Promise<void> {
  const fundRef = doc(db, SAVINGS_COLLECTION, fundId);
  const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));

  await runTransaction(db, async (transaction) => {
    const fundDoc = await transaction.get(fundRef);
    if (!fundDoc.exists()) {
      throw new Error("Sinking fund not found!");
    }
    const currentAmount = fundDoc.data().amount || 0;
    const newAmount = currentAmount + amount;
    
    transaction.update(fundRef, { amount: newAmount, lastFundedAt: new Date().toISOString() });
    
    transaction.set(transactionRef, {
      fundId,
      amount,
      type: 'deposit',
      date: new Date().toISOString(),
      userId
    });
  });
}

export async function withdrawFromSinkingFund(fundId: string, amount: number, userId: string): Promise<void> {
  const fundRef = doc(db, SAVINGS_COLLECTION, fundId);
  const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));

  await runTransaction(db, async (transaction) => {
    const fundDoc = await transaction.get(fundRef);
    if (!fundDoc.exists()) {
      throw new Error("Sinking fund not found!");
    }
    const currentAmount = fundDoc.data().amount || 0;
    if (currentAmount < amount) {
        throw new Error("Withdrawal amount exceeds the current fund balance.");
    }
    const newAmount = currentAmount - amount;
    
    transaction.update(fundRef, { amount: newAmount });
    
    transaction.set(transactionRef, {
      fundId,
      amount,
      type: 'withdraw',
      date: new Date().toISOString(),
      userId
    });
  });
}


export async function deleteSavingsItem(id: string): Promise<void> {
  const itemRef = doc(db, SAVINGS_COLLECTION, id);
  await deleteDoc(itemRef);
}

export async function getSinkingFundTransactions(fundId: string): Promise<SinkingFundTransaction[]> {
    const q = query(
        collection(db, TRANSACTIONS_COLLECTION),
        where('fundId', '==', fundId),
        orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SinkingFundTransaction));
}

