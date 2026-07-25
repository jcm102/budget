'use server';

import { db } from '@/lib/firebase-admin';
import type { Expense, Honorarium, MileageLog } from '@/types';

const EXPENSES_COLLECTION = 'expenses';
const HONORARIUM_COLLECTION = 'honorariums';
const MILEAGE_COLLECTION = 'mileage-logs';

/**
 * 1. FETCHING DATA
 */

export async function getActiveMonetaryExpenses(): Promise<Expense[]> {
  try {
    const snapshot = await db.collection(EXPENSES_COLLECTION)
      .where('status', '==', 'active')
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
  } catch (error) {
    console.error('Error fetching active monetary expenses:', error);
    return [];
  }
}

export async function getHonorariums(status: string = 'active'): Promise<Honorarium[]> {
  try {
    const snapshot = await db.collection(HONORARIUM_COLLECTION)
      .where('status', '==', status)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Honorarium));
  } catch (error) {
    console.error('Error fetching honorariums:', error);
    return [];
  }
}

/**
 * 2. ARCHIVE & HISTORY LOGIC
 */

export async function getArchivedMonths(): Promise<string[]> {
  try {
    const snapshot = await db.collection(EXPENSES_COLLECTION)
      .where('status', '==', 'archived')
      .get();
    
    const months = new Set<string>();
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.archiveKey) months.add(data.archiveKey);
    });
    
    return Array.from(months).sort().reverse();
  } catch (error) {
    console.error('Error fetching archived months:', error);
    return [];
  }
}

export async function getExpensesForMonth(archiveKey: string) {
  try {
    const [expSnap, milSnap, honSnap] = await Promise.all([
      db.collection(EXPENSES_COLLECTION).where('archiveKey', '==', archiveKey).get(),
      db.collection(MILEAGE_COLLECTION).where('archiveKey', '==', archiveKey).get(),
      db.collection(HONORARIUM_COLLECTION).where('archiveKey', '==', archiveKey).get()
    ]);

    return {
      expenses: expSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      mileageLogs: milSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })),
      honorariums: honSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    };
  } catch (error) {
    console.error('Error fetching specific archive month:', error);
    return { expenses: [], mileageLogs: [], honorariums: [] };
  }
}

/**
 * 3. MUTATIONS (ADD, UPDATE, DELETE)
 */

export async function addExpense(
  expenseData: any, 
  ledgerAccountId?: string, 
  receiptFile?: any
): Promise<void> {
  await db.collection(EXPENSES_COLLECTION).add({
    ...expenseData,
    ledgerAccountId: ledgerAccountId || null,
    status: 'active',
    createdAt: new Date().toISOString()
  });
}

export async function updateExpense(id: string, data: Partial<Expense>): Promise<void> {
  await db.collection(EXPENSES_COLLECTION).doc(id).update(data);
}

export async function deleteExpense(id: string): Promise<void> {
  await db.collection(EXPENSES_COLLECTION).doc(id).delete();
}

export async function addHonorarium(data: any): Promise<void> {
  await db.collection(HONORARIUM_COLLECTION).add({ 
    ...data, 
    status: 'active',
    createdAt: new Date().toISOString()
  });
}

export async function updateHonorarium(id: string, data: any): Promise<void> {
  await db.collection(HONORARIUM_COLLECTION).doc(id).update(data);
}

export async function deleteHonorarium(id: string): Promise<void> {
  await db.collection(HONORARIUM_COLLECTION).doc(id).delete();
}

/**
 * 4. MONTH CYCLING LOGIC
 */

export async function archiveCurrentExpenses(archiveKey: string): Promise<void> {
  const batch = db.batch();
  
  // Archive Expenses
  const activeExpenses = await db.collection(EXPENSES_COLLECTION).where('status', '==', 'active').get();
  activeExpenses.docs.forEach(doc => {
    batch.update(doc.ref, { status: 'archived', archiveKey });
  });

  // Archive Mileage
  const activeMileage = await db.collection(MILEAGE_COLLECTION).where('status', '==', 'active').get();
  activeMileage.docs.forEach(doc => {
    batch.update(doc.ref, { status: 'archived', archiveKey });
  });

  // Archive Honorariums
  const activeHonorariums = await db.collection(HONORARIUM_COLLECTION).where('status', '==', 'active').get();
  activeHonorariums.docs.forEach(doc => {
    batch.update(doc.ref, { status: 'archived', archiveKey });
  });
  
  await batch.commit();
}

export async function cycleExpensesToNextMonth(): Promise<void> {
  const batch = db.batch();
  
  // Find all expenses marked 'forNextMonth' and move them to current
  const nextMonthExpenses = await db.collection(EXPENSES_COLLECTION).where('forNextMonth', '==', true).get();
  nextMonthExpenses.docs.forEach(doc => {
    batch.update(doc.ref, { forNextMonth: false, status: 'active' });
  });

  const nextMonthMileage = await db.collection(MILEAGE_COLLECTION).where('forNextMonth', '==', true).get();
  nextMonthMileage.docs.forEach(doc => {
    batch.update(doc.ref, { forNextMonth: false, status: 'active' });
  });

  await batch.commit();
}