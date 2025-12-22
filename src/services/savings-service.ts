'use server';

import { db } from '@/lib/firebase-admin';
import type { SavingsItem, SinkingFundTransaction } from '@/types';
import { startOfToday, parseISO } from 'date-fns';

const SAVINGS_COLLECTION = 'sinking-funds';
const TRANSACTIONS_COLLECTION = 'sinking-fund-transactions';

/**
 * Logic for calculating monthly savings targets.
 * Kept identical to your original logic.
 */
const calculateMonthlyAmount = (item: SavingsItem): number => {
    const { amount, totalCost, recurrence, dueDate, isCustomGoal, goal } = item;
    if (isCustomGoal && goal) return goal;
    if (!totalCost || totalCost <= amount) return 0;

    const remainingAmount = totalCost - amount;
    if (dueDate) {
        const today = startOfToday();
        const due = parseISO(dueDate);
        if (due <= today) return remainingAmount;
        const totalMonths = (due.getFullYear() - today.getFullYear()) * 12 + (due.getMonth() - today.getMonth());
        if (totalMonths <= 0) return remainingAmount;
        return remainingAmount / totalMonths;
    }

    if (recurrence && recurrence !== 'None') {
        switch (recurrence) {
            case 'Annually': return totalCost / 11;
            case 'Quarterly': return totalCost / 3;
            case 'Semi-Annually': return totalCost / 6;
            case 'Semi-Annually (Custom)': return totalCost / 6;
            default: return 0;
        }
    }
    return 0;
};

export async function getSavingsItems(accountId: string): Promise<SavingsItem[]> {
  const snapshot = await db.collection(SAVINGS_COLLECTION)
    .where('accountId', '==', accountId)
    .get();

  const items = snapshot.docs.map(doc => {
    const data = doc.data() as Omit<SavingsItem, 'id'>;
    const item = { id: doc.id, ...data } as SavingsItem;
    return { ...item, monthlyAmount: calculateMonthlyAmount(item) };
  });

  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function addSavingsItem(itemData: Omit<SavingsItem, 'id' | 'monthlyAmount'>): Promise<SavingsItem> {
  const docRef = await db.collection(SAVINGS_COLLECTION).add({
    ...itemData,
    createdAt: new Date().toISOString()
  });
  const docSnap = await docRef.get();
  const newItem = { id: docSnap.id, ...(docSnap.data() as Omit<SavingsItem, 'id'>) } as SavingsItem;
  return { ...newItem, monthlyAmount: calculateMonthlyAmount(newItem) };
}

export async function updateSavingsItem(id: string, itemData: Partial<Omit<SavingsItem, 'id' | 'monthlyAmount'>>): Promise<void> {
  await db.collection(SAVINGS_COLLECTION).doc(id).update(itemData);
}

export async function fundSinkingFund(fundId: string, amount: number, userId: string): Promise<void> {
  const fundRef = db.collection(SAVINGS_COLLECTION).doc(fundId);
  const transactionLogRef = db.collection(TRANSACTIONS_COLLECTION).doc();

  await db.runTransaction(async (transaction) => {
    const fundDoc = await transaction.get(fundRef);
    if (!fundDoc.exists) throw new Error("Sinking fund not found!");

    const currentAmount = fundDoc.data()?.amount || 0;
    transaction.update(fundRef, { 
      amount: currentAmount + amount, 
      lastFundedAt: new Date().toISOString() 
    });

    transaction.set(transactionLogRef, {
      fundId,
      amount,
      type: 'deposit',
      date: new Date().toISOString(),
      userId
    });
  });
}

export async function withdrawFromSinkingFund(fundId: string, amount: number, userId: string): Promise<void> {
  const fundRef = db.collection(SAVINGS_COLLECTION).doc(fundId);
  const transactionLogRef = db.collection(TRANSACTIONS_COLLECTION).doc();

  await db.runTransaction(async (transaction) => {
    const fundDoc = await transaction.get(fundRef);
    if (!fundDoc.exists) throw new Error("Sinking fund not found!");

    const currentAmount = fundDoc.data()?.amount || 0;
    if (currentAmount < amount) throw new Error("Insufficient funds.");

    transaction.update(fundRef, { amount: currentAmount - amount });
    transaction.set(transactionLogRef, {
      fundId,
      amount,
      type: 'withdraw',
      date: new Date().toISOString(),
      userId
    });
  });
}

export async function transferSinkingFund(fromFundId: string, toFundId: string, amount: number, userId: string): Promise<void> {
  const fromRef = db.collection(SAVINGS_COLLECTION).doc(fromFundId);
  const toRef = db.collection(SAVINGS_COLLECTION).doc(toFundId);

  await db.runTransaction(async (transaction) => {
    const fromDoc = await transaction.get(fromRef);
    const toDoc = await transaction.get(toRef);

    if (!fromDoc.exists || !toDoc.exists) throw new Error("One or both funds not found.");

    const fromData = fromDoc.data()!;
    const toData = toDoc.data()!;

    if ((fromData.amount || 0) < amount) throw new Error("Insufficient balance for transfer.");

    transaction.update(fromRef, { amount: (fromData.amount || 0) - amount });
    transaction.update(toRef, { amount: (toData.amount || 0) + amount });

    const now = new Date().toISOString();
    transaction.set(db.collection(TRANSACTIONS_COLLECTION).doc(), {
      fundId: fromFundId, amount, type: 'withdraw', date: now, userId, notes: `Transfer to ${toData.name}`
    });
    transaction.set(db.collection(TRANSACTIONS_COLLECTION).doc(), {
      fundId: toFundId, amount, type: 'deposit', date: now, userId, notes: `Transfer from ${fromData.name}`
    });
  });
}

export async function resetSinkingFund(fundId: string, userId: string): Promise<void> {
  const fundRef = db.collection(SAVINGS_COLLECTION).doc(fundId);
  await db.runTransaction(async (transaction) => {
    const fundDoc = await transaction.get(fundRef);
    if (!fundDoc.exists) throw new Error("Fund not found.");
    const oldAmount = fundDoc.data()?.amount || 0;
    transaction.update(fundRef, { amount: 0 });
    transaction.set(db.collection(TRANSACTIONS_COLLECTION).doc(), {
      fundId, amount: oldAmount, type: 'reset', date: new Date().toISOString(), userId
    });
  });
}

export async function deleteSavingsItem(id: string): Promise<void> {
  await db.collection(SAVINGS_COLLECTION).doc(id).delete();
}

export async function getSinkingFundTransactions(fundId: string): Promise<SinkingFundTransaction[]> {
  const snapshot = await db.collection(TRANSACTIONS_COLLECTION)
    .where('fundId', '==', fundId)
    .orderBy('date', 'desc')
    .get();

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SinkingFundTransaction));
}