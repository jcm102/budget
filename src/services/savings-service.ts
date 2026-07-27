'use server';

import { db } from '@/lib/firebase-admin';
import type { SavingsItem, SinkingFundTransaction } from '@/types';
import { format, addMonths } from 'date-fns';

const SAVINGS_COLLECTION = 'sinking-funds';
const TRANSACTIONS_COLLECTION = 'sinking-fund-transactions';

export async function getSavingsItems(accountId: string): Promise<SavingsItem[]> {
  try {
    let query = db.collection(SAVINGS_COLLECTION);
    if (accountId !== 'all') {
      query = query.where('accountId', '==', accountId) as any;
    }
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavingsItem));
  } catch (error) {
    console.error('Error fetching savings items:', error);
    return [];
  }
}

function calculateMonthlyAmount(item: any, targetMonthStr?: string): number {
  if (item.isCustomGoal && item.goal != null) {
    return item.goal;
  }

  const totalCost = item.totalCost || 0;
  const amount = item.amount || 0;
  const remainingCost = Math.max(0, totalCost - amount);

  if (item.dueDate) {
    let refDate = new Date();
    if (targetMonthStr) {
      const parts = targetMonthStr.split('-');
      if (parts.length === 2) {
        refDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      }
    }

    const parts = item.dueDate.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dueDate = new Date(year, month, day);

      const yearDiff = dueDate.getFullYear() - refDate.getFullYear();
      const monthDiff = dueDate.getMonth() - refDate.getMonth();
      const monthsRemaining = yearDiff * 12 + monthDiff + 1;

      if (monthsRemaining > 0) {
        return remainingCost / monthsRemaining;
      }
    }
  }

  if (item.recurrence) {
    switch (item.recurrence) {
      case 'Quarterly':
        return totalCost / 3;
      case 'Semi-Annually':
      case 'Semi-Annually (Custom)':
        return totalCost / 6;
      case 'Annually':
        return totalCost / 12;
      case 'Bi-Annually':
        return totalCost / 24;
      default:
        return 0;
    }
  }

  return 0;
}

export async function syncSinkingFundsBudget(targetMonth?: string): Promise<void> {
  try {
    const transfereesSnapshot = await db.collection('transferees').get();
    const activeAccountIds = new Set(transfereesSnapshot.docs.map(doc => doc.id));

    const snapshot = await db.collection(SAVINGS_COLLECTION).get();
    const items = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as SavingsItem))
      .filter(item => activeAccountIds.has(item.accountId));

    const today = new Date();
    const currentMonth = format(today, 'yyyy-MM');
    const nextMonth = format(addMonths(today, 1), 'yyyy-MM');
    const months = targetMonth ? [targetMonth] : [currentMonth, nextMonth];

    const SINKING_FUNDS_CATEGORY_ID = 'KbWSJVpQRZBOTmu8HxjI';
    const BUDGET_ITEMS_COLLECTION = 'monthly-budget-items';

    for (const month of months) {
      if (month < '2026-07') {
        const querySnapshot = await db.collection(BUDGET_ITEMS_COLLECTION)
          .where('month', '==', month)
          .where('categoryId', '==', SINKING_FUNDS_CATEGORY_ID)
          .get();
        if (!querySnapshot.empty) {
          await querySnapshot.docs[0].ref.update({ budgeted: 0 });
        }
        continue;
      }

      const totalMonthly = items.reduce((sum, item) => sum + calculateMonthlyAmount(item), 0);

      const querySnapshot = await db.collection(BUDGET_ITEMS_COLLECTION)
        .where('month', '==', month)
        .where('categoryId', '==', SINKING_FUNDS_CATEGORY_ID)
        .get();

      if (querySnapshot.empty) {
        await db.collection(BUDGET_ITEMS_COLLECTION).add({
          categoryId: SINKING_FUNDS_CATEGORY_ID,
          month,
          budgeted: totalMonthly,
          breakdown: []
        });
      } else {
        const docRef = querySnapshot.docs[0].ref;
        await docRef.update({ budgeted: totalMonthly });
      }
    }
  } catch (error) {
    console.error('Error syncing sinking funds budget:', error);
  }
}

export async function addSavingsItem(itemData: any): Promise<void> {
  await db.collection(SAVINGS_COLLECTION).add({
    ...itemData,
    createdAt: new Date().toISOString()
  });
  await syncSinkingFundsBudget();
}

export async function updateSavingsItem(id: string, data: Partial<SavingsItem>): Promise<void> {
  await db.collection(SAVINGS_COLLECTION).doc(id).update(data);
  await syncSinkingFundsBudget();
}

export async function deleteSavingsItem(id: string): Promise<void> {
  await db.collection(SAVINGS_COLLECTION).doc(id).delete();
  await syncSinkingFundsBudget();
}

export async function fundSinkingFund(fundId: string, amount: number, notes: string): Promise<void> {
  const fundRef = db.collection(SAVINGS_COLLECTION).doc(fundId);
  const logRef = db.collection(TRANSACTIONS_COLLECTION).doc();

  await db.runTransaction(async (transaction) => {
    const fundDoc = await transaction.get(fundRef);
    if (!fundDoc.exists) throw new Error("Fund not found");
    const currentAmount = fundDoc.data()?.amount || 0;
    
    transaction.update(fundRef, { amount: currentAmount + amount });
    transaction.set(logRef, {
      fundId,
      amount,
      type: 'deposit',
      notes,
      date: new Date().toISOString(),
    });
  });
}

export async function withdrawFromSinkingFund(fundId: string, amount: number, notes: string): Promise<void> {
  const fundRef = db.collection(SAVINGS_COLLECTION).doc(fundId);
  const logRef = db.collection(TRANSACTIONS_COLLECTION).doc();

  await db.runTransaction(async (transaction) => {
    const fundDoc = await transaction.get(fundRef);
    if (!fundDoc.exists) throw new Error("Fund not found");
    const currentAmount = fundDoc.data()?.amount || 0;
    
    transaction.update(fundRef, { amount: currentAmount - amount });
    transaction.set(logRef, {
      fundId,
      amount,
      type: 'withdraw',
      notes,
      date: new Date().toISOString(),
    });
  });
}

export async function resetSinkingFund(fundId: string): Promise<void> {
  await db.collection(SAVINGS_COLLECTION).doc(fundId).update({ amount: 0 });
}

export async function transferSinkingFund(fromId: string, toId: string, amount: number): Promise<void> {
  const fromRef = db.collection(SAVINGS_COLLECTION).doc(fromId);
  const toRef = db.collection(SAVINGS_COLLECTION).doc(toId);

  await db.runTransaction(async (transaction) => {
    const fromDoc = await transaction.get(fromRef);
    const toDoc = await transaction.get(toRef);
    
    transaction.update(fromRef, { amount: (fromDoc.data()?.amount || 0) - amount });
    transaction.update(toRef, { amount: (toDoc.data()?.amount || 0) + amount });
  });
}

export async function getSavingsItemById(id: string): Promise<SavingsItem | null> {
  try {
    const doc = await db.collection(SAVINGS_COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as SavingsItem;
  } catch (error) {
    console.error('Error fetching savings item:', error);
    return null;
  }
}

export async function getSinkingFundTransactions(fundId: string): Promise<SinkingFundTransaction[]> {
  try {
    const snapshot = await db.collection(TRANSACTIONS_COLLECTION)
      .where('fundId', '==', fundId)
      .orderBy('date', 'desc')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SinkingFundTransaction));
  } catch (error) {
    console.error('Error fetching sinking fund transactions:', error);
    return [];
  }
}