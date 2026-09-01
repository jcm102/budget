'use server';

import { db } from '@/lib/firebase-admin';
import type { SavingsItem, SinkingFundTransaction } from '@/types';
import { format, addMonths } from 'date-fns';
import * as SettingsService from '@/services/settings-service';

const SAVINGS_COLLECTION = 'sinking-funds';
const TRANSACTIONS_COLLECTION = 'sinking-fund-transactions';
const MAIN_TRANSACTIONS_COLLECTION = 'transactions';
const SINKING_FUNDS_CATEGORY_ID = 'KbWSJVpQRZBOTmu8HxjI';

async function getLibroChequingId(): Promise<string> {
  const snap = await db.collection('transferees').where('name', '==', 'Libro Chequing').get();
  if (!snap.empty) {
    return snap.docs[0].id;
  }
  return '';
}

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

function getActiveCycle(item: any, referenceDate?: Date) {
  const currentCycle = {
    dueDate: item.dueDate,
    totalCost: item.totalCost || 0,
    goal: item.goal || 0,
  };

  if (!item.previousCycles || item.previousCycles.length === 0) {
    return currentCycle;
  }

  const allCycles = [...item.previousCycles, currentCycle].filter(c => c.dueDate);
  allCycles.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  const today = referenceDate ?? new Date();
  
  for (const cycle of allCycles) {
    if (cycle.dueDate) {
      const parts = cycle.dueDate.split('T')[0].split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dueDateObj = new Date(year, month, day);

        const yearDiff = dueDateObj.getFullYear() - today.getFullYear();
        const monthDiff = dueDateObj.getMonth() - today.getMonth();
        const monthsRemaining = yearDiff * 12 + monthDiff;

        if (monthsRemaining > 0) {
          return cycle;
        }
      }
    }
  }

  return currentCycle;
}

function calculateMonthlyAmount(item: any, targetMonthStr?: string): number {
  let refDate = new Date();
  if (targetMonthStr) {
    const parts = targetMonthStr.split('-');
    if (parts.length === 2) {
      refDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
    }
  }

  const activeCycle = getActiveCycle(item, refDate);
  const isCustomGoal = item.isCustomGoal;

  if (isCustomGoal && activeCycle.goal != null) {
    return activeCycle.goal;
  }

  const totalCost = activeCycle.totalCost || 0;

  if (activeCycle.dueDate) {
    const parts = activeCycle.dueDate.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dueDate = new Date(year, month, day);

      const yearDiff = dueDate.getFullYear() - refDate.getFullYear();
      const monthDiff = dueDate.getMonth() - refDate.getMonth();
      const monthsRemaining = yearDiff * 12 + monthDiff;

      if (monthsRemaining > 0) {
        return totalCost / monthsRemaining;
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

  return item.goal ?? 0;
}

function getExchangeRate(item: any, currentRate: number): number {
  if (item.currency !== 'USD') return 1;
  if (item.exchangeRateType === '5year') return 1.3344;
  if (item.exchangeRateType === '10year') return 1.3260;
  return currentRate;
}

export async function syncSinkingFundsBudget(targetMonth?: string, fromCycle?: boolean): Promise<void> {
  try {
    const currentRate = await SettingsService.getExchangeRate();
    const transfereesSnapshot = await db.collection('transferees').get();
    const activeAccountIds = new Set(transfereesSnapshot.docs.map(doc => doc.id));

    const snapshot = await db.collection(SAVINGS_COLLECTION).get();
    const items = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as SavingsItem))
      .filter(item => activeAccountIds.has(item.accountId) && item.status !== 'inactive');

    const today = new Date();
    const currentMonth = format(today, 'yyyy-MM');
    const nextMonth = format(addMonths(today, 1), 'yyyy-MM');

    // Always update both current and next month, or the specific target month if provided
    const months = targetMonth ? [targetMonth] : [currentMonth, nextMonth];

    const BUDGET_ITEMS_COLLECTION = 'monthly-budget-items';

    // Current month total used for the stable transfer doc
    const currentTotalMonthly = items.reduce((sum, item) => {
      const monthly = calculateMonthlyAmount(item, currentMonth);
      const rate = getExchangeRate(item, currentRate);
      return sum + (monthly * rate);
    }, 0);

    for (const month of months) {
      if (month < '2026-08') {
        const querySnapshot = await db.collection(BUDGET_ITEMS_COLLECTION)
          .where('month', '==', month)
          .where('categoryId', '==', SINKING_FUNDS_CATEGORY_ID)
          .get();
        if (!querySnapshot.empty) {
          await querySnapshot.docs[0].ref.update({ budgeted: 0 });
        }
        const oldDocRef = db.collection('budget-items').doc(`sinking-funds-transfer-${month}`);
        const oldDocSnap = await oldDocRef.get();
        if (oldDocSnap.exists) {
          await oldDocRef.delete();
        }
        continue;
      }

      const totalMonthly = items.reduce((sum, item) => {
        const monthly = calculateMonthlyAmount(item, month);
        const rate = getExchangeRate(item, currentRate);
        return sum + (monthly * rate);
      }, 0);

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
        await docRef.update({
          budgeted: totalMonthly,
          breakdown: []
        });
      }
    }

    // Always update the stable transfer doc so it matches the current month's contributions
    const STABLE_TRANSFER_ID = 'sinking-funds-transfer';
    const TRANSFER_START_DATE = '2026-08-01';
    const stableDocRef = db.collection('budget-items').doc(STABLE_TRANSFER_ID);
    const stableDocSnap = await stableDocRef.get();

    if (stableDocSnap.exists) {
      const data = stableDocSnap.data();
      const currentSplits = data?.splits || [];
      let updatedSplits = currentSplits.map((s: any) => {
        if (s.type === 'expense' && s.categoryId === SINKING_FUNDS_CATEGORY_ID) {
          return { ...s, amount: currentTotalMonthly };
        }
        return s;
      });
      if (updatedSplits.length === 0) {
        updatedSplits = [{
          id: 'sinking-funds-split',
          type: 'expense',
          amount: currentTotalMonthly,
          categoryId: SINKING_FUNDS_CATEGORY_ID
        }];
      }
      await stableDocRef.update({
        amount: currentTotalMonthly,
        date: TRANSFER_START_DATE,
        splits: updatedSplits
      });
    } else {
      await stableDocRef.set({
        type: 'Transfers',
        description: 'EFT to Sinking Funds',
        amount: currentTotalMonthly,
        date: TRANSFER_START_DATE,
        frequency: 'Monthly',
        transferFrom: 'Libro Chequing',
        transferTo: 'EQ Sinking Funds',
        completed: false,
        scheduled: false,
        splits: [{
          id: 'sinking-funds-split',
          type: 'expense',
          amount: currentTotalMonthly,
          categoryId: SINKING_FUNDS_CATEGORY_ID
        }]
      });
    }

    // Clean up any old per-month transfer docs
    for (const month of [currentMonth, nextMonth]) {
      const oldDocRef = db.collection('budget-items').doc(`sinking-funds-transfer-${month}`);
      const oldDocSnap = await oldDocRef.get();
      if (oldDocSnap.exists) { await oldDocRef.delete(); }
    }

  } catch (error) {
    console.error('Error syncing sinking funds budget:', error);
  }
}

// ---------------------------------------------------------------------------
// Bulk auto-funding — called when EFT to Sinking Funds is marked complete
// ---------------------------------------------------------------------------

const AUTO_FUND_PREFIX = 'Auto-funded via EFT to Sinking Funds';

export async function bulkFundSinkingFunds(month: string): Promise<void> {
  // Ensure we only fund for current month or future months
  const today = new Date();
  const currentMonth = format(today, 'yyyy-MM');
  if (month < currentMonth) {
    // Skip funding for past months
    console.warn(`Attempted to bulk fund sinking funds for past month ${month}. Skipping.`);
    return;
  }

  // Clean up any stale auto-fund logs for months earlier than current month
  const staleTxSnap = await db.collection(TRANSACTIONS_COLLECTION)
    .where('notes', '>=', `${AUTO_FUND_PREFIX} (${currentMonth})`)
    .get();
  // (No removal needed for future months; earlier months already shouldn't exist.)

  const currentRate = await SettingsService.getExchangeRate();
  const activeSnap = await db.collection('transferees').get();
  const activeIds = new Set(activeSnap.docs.map(d => d.id));

  const fundsSnap = await db.collection(SAVINGS_COLLECTION).get();
  const items = fundsSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter((item: any) => activeIds.has(item.accountId) && item.status !== 'inactive') as any[];

  const batch = db.batch();
  const now = new Date().toISOString();
  const notes = `${AUTO_FUND_PREFIX} (${month})`;
  const sourceAccountId = await getLibroChequingId();

  for (const item of items) {
    const monthly = calculateMonthlyAmount(item, month);
    if (monthly <= 0) continue;

    const rate = getExchangeRate(item, currentRate);
    const amountCAD = item.currency === 'USD' ? monthly * rate : monthly;

    batch.update(db.collection(SAVINGS_COLLECTION).doc(item.id), {
      amount: (item.amount || 0) + monthly,
    });
    batch.set(db.collection(TRANSACTIONS_COLLECTION).doc(), {
      fundId: item.id,
      amount: monthly,
      type: 'deposit',
      notes,
      date: now,
    });
    batch.set(db.collection(MAIN_TRANSACTIONS_COLLECTION).doc(), {
      date: `${month}-01`,
      amount: amountCAD,
      description: `Funded Sinking Fund: ${item.name}`,
      notes,
      sourceAccountId,
      splits: [{
        id: 'split-0',
        categoryId: SINKING_FUNDS_CATEGORY_ID,
        amount: amountCAD,
        type: 'expense'
      }]
    });
  }

  await batch.commit();
  // Recalculate next month's projections with the updated balances
  await syncSinkingFundsBudget();
}

export async function bulkWithdrawSinkingFunds(month: string): Promise<void> {
  const today = new Date();
  const currentMonth = format(today, 'yyyy-MM');
  if (month < currentMonth) {
    console.warn(`Attempted to bulk withdraw sinking funds for past month ${month}. Skipping.`);
    return;
  }

  const notes = `${AUTO_FUND_PREFIX} (${month})`;

  // Find auto-deposit transactions for this month
  const txSnap = await db.collection(TRANSACTIONS_COLLECTION)
    .where('notes', '==', notes)
    .where('type', '==', 'deposit')
    .get();

  if (txSnap.empty) return;

  const depositsByFund = new Map<string, number>();
  txSnap.docs.forEach(d => {
    const data = d.data() as any;
    depositsByFund.set(data.fundId, (depositsByFund.get(data.fundId) || 0) + data.amount);
  });

  const fundRefs = [...depositsByFund.keys()].map(id => db.collection(SAVINGS_COLLECTION).doc(id));
  const fundSnaps = await Promise.all(fundRefs.map(ref => ref.get()));

  const batch = db.batch();
  const now = new Date().toISOString();
  const reversalNotes = `Reversed EFT to Sinking Funds (${month})`;

  fundSnaps.forEach(snap => {
    if (!snap.exists) return;
    const depositedAmount = depositsByFund.get(snap.id) || 0;
    const currentAmount = (snap.data() as any).amount || 0;

    batch.update(snap.ref, { amount: Math.max(0, currentAmount - depositedAmount) });
    batch.set(db.collection(TRANSACTIONS_COLLECTION).doc(), {
      fundId: snap.id,
      amount: depositedAmount,
      type: 'withdraw',
      notes: reversalNotes,
      date: now,
    });
  });

  // Remove original auto-deposit entries
  txSnap.docs.forEach(d => batch.delete(d.ref));

  // Remove corresponding budget actual transactions
  const budgetTxSnap = await db.collection(MAIN_TRANSACTIONS_COLLECTION)
    .where('notes', '==', notes)
    .get();
  budgetTxSnap.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();
  await syncSinkingFundsBudget();
}

export async function addSavingsItem(itemData: any): Promise<void> {
  await db.collection(SAVINGS_COLLECTION).add({
    ...itemData,
    createdAt: new Date().toISOString()
  });
  await syncSinkingFundsBudget(); // updates next month only (current month frozen)
}

export async function updateSavingsItem(id: string, data: Partial<SavingsItem>): Promise<void> {
  await db.collection(SAVINGS_COLLECTION).doc(id).update(data);
  await syncSinkingFundsBudget(); // updates next month only
}

export async function deleteSavingsItem(id: string): Promise<void> {
  await db.collection(SAVINGS_COLLECTION).doc(id).delete();
  await syncSinkingFundsBudget(); // updates next month only
}

export async function fundSinkingFund(fundId: string, amount: number, notes: string): Promise<void> {
  const fundRef = db.collection(SAVINGS_COLLECTION).doc(fundId);
  const logRef = db.collection(TRANSACTIONS_COLLECTION).doc();
  const budgetTxRef = db.collection(MAIN_TRANSACTIONS_COLLECTION).doc();

  const sourceAccountId = await getLibroChequingId();
  const currentRate = await SettingsService.getExchangeRate();

  await db.runTransaction(async (transaction) => {
    const fundDoc = await transaction.get(fundRef);
    if (!fundDoc.exists) throw new Error("Fund not found");
    const currentAmount = fundDoc.data()?.amount || 0;
    const rate = getExchangeRate(fundDoc.data(), currentRate);
    const amountCAD = fundDoc.data()?.currency === 'USD' ? amount * rate : amount;

    transaction.update(fundRef, { amount: currentAmount + amount });
    transaction.set(logRef, {
      fundId,
      amount,
      type: 'deposit',
      notes,
      date: new Date().toISOString(),
    });
    transaction.set(budgetTxRef, {
      date: new Date().toISOString().split('T')[0],
      amount: amountCAD,
      description: `Funded Sinking Fund: ${fundDoc.data()?.name}`,
      notes,
      sourceAccountId,
      splits: [{
        id: 'split-0',
        categoryId: SINKING_FUNDS_CATEGORY_ID,
        amount: amountCAD,
        type: 'expense'
      }]
    });
  });
  // Recalculate next month's required contribution based on updated balances
  // (current month stays frozen)
  await syncSinkingFundsBudget();
}

export async function withdrawFromSinkingFund(fundId: string, amount: number, notes: string): Promise<void> {
  const fundRef = db.collection(SAVINGS_COLLECTION).doc(fundId);
  const logRef = db.collection(TRANSACTIONS_COLLECTION).doc();
  const budgetTxRef = db.collection(MAIN_TRANSACTIONS_COLLECTION).doc();
  
  const sourceAccountId = await getLibroChequingId();
  const currentRate = await SettingsService.getExchangeRate();

  await db.runTransaction(async (transaction) => {
    const fundDoc = await transaction.get(fundRef);
    if (!fundDoc.exists) throw new Error("Fund not found");
    const currentAmount = fundDoc.data()?.amount || 0;
    const rate = getExchangeRate(fundDoc.data(), currentRate);
    const amountCAD = fundDoc.data()?.currency === 'USD' ? amount * rate : amount;
    
    transaction.update(fundRef, { amount: currentAmount - amount });
    transaction.set(logRef, {
      fundId,
      amount,
      type: 'withdraw',
      notes,
      date: new Date().toISOString(),
    });
    transaction.set(budgetTxRef, {
      date: new Date().toISOString().split('T')[0],
      amount: -amountCAD,
      description: `Withdrew from Sinking Fund: ${fundDoc.data()?.name}`,
      notes,
      sourceAccountId,
      splits: [{
        id: 'split-0',
        categoryId: SINKING_FUNDS_CATEGORY_ID,
        amount: -amountCAD,
        type: 'expense'
      }]
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

// ---------------------------------------------------------------------------
// Sync Wealthsimple Mastercard Transfer
// ---------------------------------------------------------------------------
// Sums all monthly-budget-item breakdown sub-items where paymentMethod is
// 'Wealthsimple Mastercard' for the given month and writes the total to a
// single stable budget-items document that the budget engine picks up as a
// recurring Monthly transfer.
export async function syncWealthsimpleTransfer(targetMonth?: string): Promise<void> {
  try {
    const today = new Date();
    const month = targetMonth ?? format(today, 'yyyy-MM');
    const transferDate = `${month}-01`; // first of the month

    // 1. Aggregate the total across all monthly-budget-items breakdown entries
    const itemsSnap = await db.collection('monthly-budget-items')
      .where('month', '==', month)
      .get();

    let total = 0;
    itemsSnap.forEach(docSnap => {
      const data = docSnap.data() as any;
      if (Array.isArray(data.breakdown)) {
        data.breakdown.forEach((sub: any) => {
          if (sub.paymentMethod === 'Wealthsimple Mastercard' && typeof sub.amount === 'number') {
            total += sub.amount;
          }
        });
      }
    });

    // 2. Write / update the stable recurring transfer document
    const STABLE_ID = 'wealthsimple-mastercard-transfer';
    const stableRef = db.collection('budget-items').doc(STABLE_ID);
    const stableSnap = await stableRef.get();

    if (stableSnap.exists) {
      await stableRef.update({
        amount: total,
        date: transferDate,
      });
    } else {
      await stableRef.set({
        type: 'Transfers',
        description: 'Wealthsimple Mastercard',
        amount: total,
        date: transferDate,
        frequency: 'Monthly',
        completed: false,
        scheduled: false,
      });
    }
  } catch (error) {
    console.error('Error syncing Wealthsimple Mastercard transfer:', error);
  }
}