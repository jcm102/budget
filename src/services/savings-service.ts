
'use server';
import { db } from '@/lib/firebase';
import type { SavingsItem, SavingsRecurrence, SinkingFundTransaction } from '@/types';
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
  writeBatch,
  runTransaction
} from 'firebase/firestore';
import { addMonths, set, format, startOfToday, parse, isBefore, differenceInCalendarMonths } from 'date-fns';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

const SAVINGS_COLLECTION = 'sinking-funds';
const SINKING_FUND_TRANSACTIONS_COLLECTION = 'sinking-fund-transactions';

const recurrenceIntervalMap: Record<SavingsRecurrence, number> = {
    'None': 0,
    'Quarterly': 3,
    'Semi-Annually': 6,
    'Semi-Annually (Custom)': 0, // Custom logic handled separately
    'Annually': 12,
    'Bi-Annually': 24,
};


const calculateMonthlyAmount = (item: SavingsItem): number => {
    const { totalCost, amount, dueDate, goal } = item;

    if (goal && goal > 0) return goal;

    if (!dueDate || !totalCost || totalCost <= 0) return 0;

    const remainingAmount = totalCost - amount;
    if (remainingAmount <= 0) return 0;

    const today = startOfToday();
    const due = parse(dueDate, "yyyy-MM-dd", new Date());

    let monthsRemaining = differenceInCalendarMonths(due, today);

    if (monthsRemaining > 0) {
        monthsRemaining -= 1;
    }
    
    if (monthsRemaining < 0) { // Past due
        return remainingAmount;
    }

    // If due this month or next, it's 1 payment period (the next month)
    if (monthsRemaining === 0) {
        return remainingAmount;
    }
    
    return remainingAmount / (monthsRemaining);
};


export async function getSavingsItems(accountId: string): Promise<SavingsItem[]> {
  const savingsCollection = collection(db, SAVINGS_COLLECTION);
  const q = query(savingsCollection, where('accountId', '==', accountId));
  const querySnapshot = await getDocs(q);
  
  const items = querySnapshot.docs.map(doc => {
    const data = { id: doc.id, ...doc.data() } as SavingsItem;
    // Calculate and attach the monthly amount on the server
    const monthlyAmount = calculateMonthlyAmount(data);
    return { ...data, monthlyAmount };
  });

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function addSavingsItem(itemData: Omit<SavingsItem, 'id' | 'monthlyAmount'>): Promise<SavingsItem> {
  const docRef = await addDoc(collection(db, SAVINGS_COLLECTION), itemData);
  const docSnap = await getDoc(docRef);
  const newItem = { id: docSnap.id, ...(docSnap.data() as Omit<SavingsItem, 'id'>) };

  // Add a transaction for the initial amount if it's greater than 0
  if (itemData.amount > 0) {
    const transactionData: Omit<SinkingFundTransaction, 'id'> = {
      fundId: docRef.id,
      amount: itemData.amount,
      type: 'deposit',
      date: new Date().toISOString().split('T')[0],
    };
    await addDoc(collection(db, SINKING_FUND_TRANSACTIONS_COLLECTION), transactionData);
  }

  return {
    ...newItem,
    monthlyAmount: calculateMonthlyAmount(newItem as SavingsItem),
  };
}

export async function updateSavingsItem(id: string, itemData: Partial<Omit<SavingsItem, 'id' | 'monthlyAmount'>>): Promise<void> {
  const itemRef = doc(db, SAVINGS_COLLECTION, id);

  // For amount changes, we need to log a transaction
  if (typeof itemData.amount === 'number') {
    const docSnap = await getDoc(itemRef);
    if (docSnap.exists()) {
      const existingData = docSnap.data() as SavingsItem;
      const oldAmount = existingData.amount;
      const newAmount = itemData.amount;

      if (newAmount !== oldAmount) {
        const transactionData: Omit<SinkingFundTransaction, 'id'> = {
          fundId: id,
          amount: Math.abs(newAmount - oldAmount),
          type: newAmount > oldAmount ? 'deposit' : 'withdraw',
          date: new Date().toISOString().split('T')[0],
        };
        await addDoc(collection(db, SINKING_FUND_TRANSACTIONS_COLLECTION), transactionData);
      }
    }
  }

  await updateDoc(itemRef, itemData);
}

export async function deleteSavingsItem(id: string): Promise<void> {
  const batch = writeBatch(db);
  const itemRef = doc(db, SAVINGS_COLLECTION, id);
  batch.delete(itemRef);

  const q = query(collection(db, SINKING_FUND_TRANSACTIONS_COLLECTION), where('fundId', '==', id));
  const snapshot = await getDocs(q);
  snapshot.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
}


export async function getSinkingFundTransactions(userId: string, fundId: string): Promise<SinkingFundTransaction[]> {
    const q = query(
        collection(db, SINKING_FUND_TRANSACTIONS_COLLECTION),
        where('fundId', '==', fundId),
        orderBy('date', 'desc')
    );
    try {
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SinkingFundTransaction));
    } catch (serverError: any) {
       console.error("Failed to get sinking fund transactions:", serverError);
        throw serverError;
    }
}
