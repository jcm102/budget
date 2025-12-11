
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
import { addMonths, set, format, startOfToday, parse, isBefore, getYear, getMonth, differenceInCalendarMonths, startOfMonth } from 'date-fns';
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
    const { totalCost, amount, dueDate, goal, isCustomGoal } = item;

    if (isCustomGoal && goal && goal > 0) {
        return goal;
    }
    
    if (!dueDate || !totalCost || totalCost <= 0) return 0;

    const remainingAmount = totalCost - amount;
    if (remainingAmount <= 0) return 0;
    
    const today = startOfToday();
    const due = startOfMonth(parse(dueDate, "yyyy-MM-dd", new Date()));

    if (!isBefore(today, due)) {
        return remainingAmount;
    }
    
    const yearDiff = due.getFullYear() - today.getFullYear();
    const monthDiff = due.getMonth() - today.getMonth();

    let totalMonths = yearDiff * 12 + monthDiff;

    if (totalMonths <= 0) {
      return remainingAmount;
    }

    return remainingAmount / totalMonths;
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
    const dataWithTimestamp = {
        ...itemData,
        goal: itemData.isCustomGoal ? itemData.goal : null,
        totalCost: !itemData.isCustomGoal ? itemData.totalCost : null,
        dueDate: !itemData.isCustomGoal ? itemData.dueDate : null,
        recurrence: !itemData.isCustomGoal ? itemData.recurrence : null,
        primaryPaymentMonth: !itemData.isCustomGoal && itemData.recurrence === 'Semi-Annually (Custom)' ? itemData.primaryPaymentMonth : null,
        secondaryPaymentMonth: !itemData.isCustomGoal && itemData.recurrence === 'Semi-Annually (Custom)' ? itemData.secondaryPaymentMonth : null,
        lastFundedAt: null,
    };

    const docRef = await addDoc(collection(db, SAVINGS_COLLECTION), dataWithTimestamp);
    const docSnap = await getDoc(docRef);
    const newItem = { id: docSnap.id, ...(docSnap.data() as Omit<SavingsItem, 'id'>) };

    return {
        ...newItem,
        monthlyAmount: calculateMonthlyAmount(newItem as SavingsItem),
    };
}


export async function updateSavingsItem(id: string, itemData: Partial<Omit<SavingsItem, 'id' | 'monthlyAmount'>>): Promise<void> {
    const itemRef = doc(db, SAVINGS_COLLECTION, id);
    
    const dataToUpdate: Partial<Omit<SavingsItem, 'id' | 'monthlyAmount'>> = { ...itemData };
     if (itemData.isCustomGoal === true) {
      dataToUpdate.totalCost = null;
      dataToUpdate.dueDate = null;
      dataToUpdate.recurrence = null;
      dataToUpdate.primaryPaymentMonth = null;
      dataToUpdate.secondaryPaymentMonth = null;
    } else if (itemData.isCustomGoal === false) {
      dataToUpdate.goal = null;
    }
    
    await updateDoc(itemRef, dataToUpdate);
}

export async function fundSinkingFund(fundId: string, amount: number, userId: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const fundRef = doc(db, SAVINGS_COLLECTION, fundId);
    const transactionRef = doc(collection(db, SINKING_FUND_TRANSACTIONS_COLLECTION));

    const fundDoc = await transaction.get(fundRef);
    if (!fundDoc.exists()) {
      throw new Error("Sinking fund not found!");
    }

    const currentAmount = fundDoc.data().amount || 0;
    const newAmount = currentAmount + amount;
    const today = format(new Date(), 'yyyy-MM-dd');

    // Update the fund balance and last funded date
    transaction.update(fundRef, { 
        amount: newAmount,
        lastFundedAt: new Date().toISOString() 
    });

    // Create a transaction record
    transaction.set(transactionRef, {
      fundId,
      amount,
      type: 'deposit',
      date: today,
      userId: userId,
    });
  });
}

export async function withdrawFromSinkingFund(fundId: string, amount: number, userId: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const fundRef = doc(db, SAVINGS_COLLECTION, fundId);
    const transactionRef = doc(collection(db, SINKING_FUND_TRANSACTIONS_COLLECTION));

    const fundDoc = await transaction.get(fundRef);
    if (!fundDoc.exists()) {
      throw new Error("Sinking fund not found!");
    }

    const currentAmount = fundDoc.data().amount || 0;
    const newAmount = currentAmount - amount;
    const today = format(new Date(), 'yyyy-MM-dd');

    transaction.update(fundRef, { amount: newAmount < 0 ? 0 : newAmount });

    transaction.set(transactionRef, {
      fundId,
      amount,
      type: 'withdraw',
      date: today,
      userId: userId,
    });
  });
}

export async function moveSinkingFundMoney(fromFundId: string, toFundId: string, amount: number, userId: string): Promise<void> {
  await runTransaction(db, async (transaction) => {
    const fromFundRef = doc(db, SAVINGS_COLLECTION, fromFundId);
    const toFundRef = doc(db, SAVINGS_COLLECTION, toFundId);
    
    const fromTransactionRef = doc(collection(db, SINKING_FUND_TRANSACTIONS_COLLECTION));
    const toTransactionRef = doc(collection(db, SINKING_FUND_TRANSACTIONS_COLLECTION));

    const [fromFundDoc, toFundDoc] = await Promise.all([
        transaction.get(fromFundRef),
        transaction.get(toFundRef)
    ]);
    
    if (!fromFundDoc.exists() || !toFundDoc.exists()) {
        throw new Error("One or both sinking funds not found.");
    }
    
    const fromFundData = fromFundDoc.data();
    const toFundData = toFundDoc.data();
    
    const newFromAmount = (fromFundData.amount || 0) - amount;
    const newToAmount = (toFundData.amount || 0) + amount;
    const today = format(new Date(), 'yyyy-MM-dd');

    transaction.update(fromFundRef, { amount: newFromAmount < 0 ? 0 : newFromAmount });
    transaction.update(toFundRef, { amount: newToAmount });

    transaction.set(fromTransactionRef, {
        fundId: fromFundId,
        amount: amount,
        type: 'withdraw',
        date: today,
        userId: userId,
        notes: `Moved to ${toFundData.name}`
    });

    transaction.set(toTransactionRef, {
        fundId: toFundId,
        amount: amount,
        type: 'deposit',
        date: today,
        userId: userId,
        notes: `Moved from ${fromFundData.name}`
    });
  });
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
