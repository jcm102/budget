

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
} from 'firebase/firestore';
import { addMonths, set, format, startOfToday, parse, isBefore, differenceInCalendarMonths } from 'date-fns';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

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

export async function addSavingsItem(userId: string, itemData: Omit<SavingsItem, 'id' | 'monthlyAmount'>): Promise<SavingsItem> {
  const docRef = await addDoc(collection(db, SAVINGS_COLLECTION), itemData);
  const docSnap = await getDoc(docRef);
  const newItem = { id: docRef.id, ...(docSnap.data() as Omit<SavingsItem, 'id'>) };
  
  // Also create an initial deposit transaction
  if (newItem.amount > 0) {
      const transactionData: Omit<SinkingFundTransaction, 'id'> = {
          fundId: newItem.id,
          amount: newItem.amount,
          type: 'deposit',
          date: new Date().toISOString().split('T')[0],
      };
      const transactionCollectionRef = collection(db, 'users', userId, SINKING_FUND_TRANSACTIONS_COLLECTION);
      
      addDoc(transactionCollectionRef, transactionData).then(newTransaction => {
        const transactionRef = doc(db, 'users', userId, SINKING_FUND_TRANSACTIONS_COLLECTION, newTransaction.id);
        updateDoc(transactionRef, { id: newTransaction.id }).catch((e) => console.error("Error setting transaction ID", e));
      }).catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
            path: `users/${userId}/${SINKING_FUND_TRANSACTIONS_COLLECTION}`,
            operation: 'create',
            requestResourceData: transactionData,
          });
          errorEmitter.emit('permission-error', permissionError);
          // Re-throw to ensure calling function knows it failed
          throw serverError;
      });
  }

  return {
    ...newItem,
    monthlyAmount: calculateMonthlyAmount(newItem as SavingsItem),
  }
}

export async function updateSavingsItem(userId: string, id: string, itemData: Partial<Omit<SavingsItem, 'id' | 'monthlyAmount'>>): Promise<void> {
  const itemRef = doc(db, SAVINGS_COLLECTION, id);
  const docSnap = await getDoc(itemRef);

  if (!docSnap.exists()) {
    throw new Error('Savings item not found');
  }

  const existingData = docSnap.data() as SavingsItem;
  const oldAmount = existingData.amount;
  const newAmount = itemData.amount;

  if (typeof newAmount === 'number' && newAmount !== oldAmount) {
      const transactionData: Omit<SinkingFundTransaction, 'id'> = {
          fundId: id,
          amount: Math.abs(newAmount - oldAmount),
          type: newAmount > oldAmount ? 'deposit' : 'withdraw',
          date: new Date().toISOString().split('T')[0],
      };
      const transactionCollectionRef = collection(db, 'users', userId, SINKING_FUND_TRANSACTIONS_COLLECTION);
      
      addDoc(transactionCollectionRef, transactionData).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
          path: `users/${userId}/${SINKING_FUND_TRANSACTIONS_COLLECTION}`,
          operation: 'create',
          requestResourceData: transactionData,
        });
        errorEmitter.emit('permission-error', permissionError);
        throw serverError;
      });
  }


  const wasWithdrawal = 'amount' in itemData && itemData.amount! < existingData.amount;

  // Check for reset condition
  if (
    wasWithdrawal &&
    existingData.recurrence &&
    existingData.recurrence !== 'None' &&
    existingData.dueDate &&
    existingData.totalCost &&
    existingData.totalCost > 0
  ) {
    const amountWithdrawn = existingData.amount - itemData.amount!;

    // If they withdrew at least the total cost, reset the date.
    if (amountWithdrawn >= existingData.totalCost) {
      if (existingData.recurrence === 'Semi-Annually (Custom)' && existingData.primaryPaymentMonth && existingData.secondaryPaymentMonth) {
          const currentDueDate = parse(existingData.dueDate, 'yyyy-MM-dd', new Date());
          const currentDueMonth = currentDueDate.getMonth() + 1;
          const p1 = existingData.primaryPaymentMonth;
          const p2 = existingData.secondaryPaymentMonth;

          let nextDueDate: Date;

          if (currentDueMonth === p1) {
              nextDueDate = set(currentDueDate, { month: p2 - 1 });
          } else {
              nextDueDate = set(currentDueDate, { year: currentDueDate.getFullYear() + 1, month: p1 - 1 });
          }
          itemData.dueDate = format(nextDueDate, 'yyyy-MM-dd');

      } else {
          const monthsToAdd = recurrenceIntervalMap[existingData.recurrence];
          if (monthsToAdd > 0) {
            const newDueDate = addMonths(parse(existingData.dueDate, 'yyyy-MM-dd', new Date()), monthsToAdd);
            itemData.dueDate = format(newDueDate, 'yyyy-MM-dd');
          }
      }
      
      itemData.amount = existingData.amount - existingData.totalCost;
      if(itemData.amount < 0) itemData.amount = 0;
    }
  }
  
  if (itemData.dueDate) {
      itemData.dueDate = itemData.dueDate.split('T')[0];
  }


  const cleanItemData = Object.fromEntries(Object.entries(itemData).filter(([_, v]) => v !== undefined));
  await updateDoc(itemRef, cleanItemData);
}


export async function deleteSavingsItem(userId: string, id: string): Promise<void> {
  const itemRef = doc(db, SAVINGS_COLLECTION, id);
  await deleteDoc(itemRef);
  
  // Also delete associated transactions
  const q = query(collection(db, 'users', userId, SINKING_FUND_TRANSACTIONS_COLLECTION), where('fundId', '==', id));
  const snapshot = await getDocs(q);
  const batch = writeBatch(db);
  snapshot.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}


export async function getSinkingFundTransactions(userId: string, fundId: string): Promise<SinkingFundTransaction[]> {
    const q = query(
        collection(db, 'users', userId, SINKING_FUND_TRANSACTIONS_COLLECTION),
        where('fundId', '==', fundId),
        orderBy('date', 'desc')
    );
    try {
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SinkingFundTransaction));
    } catch (serverError: any) {
        if (serverError.code === 'permission-denied' || serverError.code === 'failed-precondition') {
             const permissionError = new FirestorePermissionError({
                path: `users/${userId}/sinking-fund-transactions`,
                operation: 'list',
            });
            errorEmitter.emit('permission-error', permissionError);
        }
        // Re-throw the original error after emitting so the caller knows the operation failed.
        throw serverError;
    }
}
