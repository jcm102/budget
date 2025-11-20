
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
    const itemRef = doc(collection(db, SAVINGS_COLLECTION));
    const transactionRef = doc(collection(db, SINKING_FUND_TRANSACTIONS_COLLECTION));

    await addDoc(collection(db, SAVINGS_COLLECTION), itemData);
    
    const docSnap = await getDoc(itemRef);
    const newItem = { id: docSnap.id, ...(docSnap.data() as Omit<SavingsItem, 'id'>) };

    return {
        ...newItem,
        monthlyAmount: calculateMonthlyAmount(newItem as SavingsItem),
    };
}


export async function updateSavingsItem(id: string, itemData: Partial<Omit<SavingsItem, 'id' | 'monthlyAmount'>>): Promise<void> {
    const itemRef = doc(db, SAVINGS_COLLECTION, id);
    await updateDoc(itemRef, itemData);
}

export async function deleteSavingsItem(id: string): Promise<void> {
  const batch = writeBatch(db);
  const itemRef = doc(db, SAVINGS_COLLECTION, id);
  batch.delete(itemRef);

  const q = query(collection(db, SINKING_FUND_TRANSACTIONS_COLLECTION), where('fundId', '==', id));
  
  try {
    const snapshot = await getDocs(q);
    snapshot.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
  } catch(e: any) {
    const permissionError = new FirestorePermissionError({
        path: itemRef.path,
        operation: 'delete',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw e;
  }
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
