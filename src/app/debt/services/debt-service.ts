'use server';

import { db } from '@/lib/firebase-admin';
import type { Debt } from '@/types';
import { createAutomatedBackup } from '@/services/backup-service';

const DEBT_COLLECTION = 'debts';

export async function getDebts(month: string, includeArchived = false): Promise<Debt[]> {
  const querySnapshot = await db.collection(DEBT_COLLECTION).orderBy('order').get();
  const debtPromises = querySnapshot.docs.map(async (docSnap) => {
    const baseData = docSnap.data();
    const isArchived = baseData.archived === true;
    
    const monthlyRef = docSnap.ref.collection('months').doc(month);
    const monthlySnap = await monthlyRef.get();
    
    let monthlyData = {};
    if (monthlySnap.exists) {
      monthlyData = monthlySnap.data() || {};
    } else {
      const monthsSnap = await docSnap.ref.collection('months').get();
      let latestPrevMonthData: any = {};
      let latestMonthKey = '';
      
      monthsSnap.forEach(mSnap => {
        const mKey = mSnap.id;
        if (mKey < month && mKey > latestMonthKey) {
          latestMonthKey = mKey;
          latestPrevMonthData = mSnap.data() || {};
        }
      });
      
      const prevBalance = latestPrevMonthData.balance !== undefined ? latestPrevMonthData.balance : (baseData.balance || 0);
      
      // If it is archived and previous balance is already 0, skip creating document to avoid cluttering DB
      if (isArchived && prevBalance <= 0 && !includeArchived) {
        return null;
      }
      
      const prevDueDate = latestPrevMonthData.dueDate || baseData.dueDate;
      let targetDueDate = '';
      if (prevDueDate) {
        const dayPart = prevDueDate.split('-')[2] || '01';
        targetDueDate = `${month}-${dayPart}`;
      } else {
        targetDueDate = `${month}-01`;
      }
      
      const initialData = {
        balance: prevBalance,
        minimumPayment: latestPrevMonthData.minimumPayment !== undefined ? latestPrevMonthData.minimumPayment : (baseData.minimumPayment || 0),
        plannedPayment: latestPrevMonthData.plannedPayment !== undefined ? latestPrevMonthData.plannedPayment : (baseData.plannedPayment || 0),
        dueDate: targetDueDate,
        paid: false
      };
      
      await monthlyRef.set(initialData);
      monthlyData = initialData;
    }
    
    const balance = (monthlyData as any).balance || 0;
    
    // Hide archived debts from view unless explicitly toggled ON, or they still have an active balance for that month
    if (isArchived && !includeArchived && balance <= 0) {
      return null;
    }
    
    return {
      id: docSnap.id,
      ...baseData,
      ...monthlyData
    } as Debt;
  });

  const results = await Promise.all(debtPromises);
  return results.filter((d): d is Debt => d !== null);
}

export async function archiveDebt(id: string, archived: boolean): Promise<void> {
  await db.collection(DEBT_COLLECTION).doc(id).update({ archived });
}

export async function addDebt(debtData: Omit<Debt, 'id' | 'order'>, month: string): Promise<Debt> {
  const snapshot = await db.collection(DEBT_COLLECTION).get();
  const newOrder = snapshot.size;
  
  const baseDebt = {
    name: debtData.name,
    interestRate: debtData.interestRate || 0,
    debtType: debtData.debtType || 'Credit Card',
    order: newOrder,
    archived: false
  };
  
  const docRef = db.collection(DEBT_COLLECTION).doc();
  await docRef.set(baseDebt);
  
  const monthlyData = {
    balance: debtData.balance || 0,
    minimumPayment: debtData.minimumPayment || 0,
    plannedPayment: debtData.plannedPayment || 0,
    dueDate: debtData.dueDate || `${month}-01`,
    paid: debtData.paid || false
  };
  
  await docRef.collection('months').doc(month).set(monthlyData);
  
  return {
    id: docRef.id,
    ...baseDebt,
    ...monthlyData
  } as Debt;
}

export async function updateDebt(id: string, month: string, debtData: Partial<Omit<Debt, 'id' | 'order'>>): Promise<void> {
  const debtRef = db.collection(DEBT_COLLECTION).doc(id);
  const baseFields = ['name', 'interestRate', 'debtType', 'archived'];
  
  const baseUpdate: any = {};
  const monthlyUpdate: any = {};
  
  Object.keys(debtData).forEach(key => {
    if (baseFields.includes(key)) {
      baseUpdate[key] = (debtData as any)[key];
    } else {
      monthlyUpdate[key] = (debtData as any)[key];
    }
  });
  
  if (Object.keys(baseUpdate).length > 0) {
    await debtRef.update(baseUpdate);
  }
  
  if (Object.keys(monthlyUpdate).length > 0) {
    await debtRef.collection('months').doc(month).set(monthlyUpdate, { merge: true });
  }
}

export async function addExtraPayment(id: string, month: string, amount: number): Promise<void> {
  await db.runTransaction(async (transaction) => {
    const monthlyRef = db.collection(DEBT_COLLECTION).doc(id).collection('months').doc(month);
    const docSnap = await transaction.get(monthlyRef);
    const currentPayment = docSnap.exists ? (docSnap.data()?.plannedPayment || 0) : 0;
    transaction.set(monthlyRef, { plannedPayment: currentPayment + amount }, { merge: true });
  });
}

export async function updateDebtOrder(debts: Debt[]): Promise<void> {
  const batch = db.batch();
  debts.forEach((debt, index) => {
    batch.update(db.collection(DEBT_COLLECTION).doc(debt.id), { order: index });
  });
  await batch.commit();
}

export async function deleteDebt(id: string): Promise<void> {
  await db.collection(DEBT_COLLECTION).doc(id).delete();
}

export async function resetDebtValues(month: string): Promise<void> {
  await createAutomatedBackup(`pre-debt-reset-${month}`);
  const querySnapshot = await db.collection(DEBT_COLLECTION).get();
  const batch = db.batch();
  querySnapshot.forEach(docSnap => {
    const monthlyRef = docSnap.ref.collection('months').doc(month);
    batch.set(monthlyRef, {
      balance: 0,
      minimumPayment: 0,
      plannedPayment: 0,
      dueDate: `${month}-01`,
      paid: false
    });
  });
  await batch.commit();
}

export async function applyPaymentsToBudget(month: string, payments: Record<string, number>): Promise<void> {
  await db.runTransaction(async (transaction) => {
    for (const debtId in payments) {
      const monthlyRef = db.collection(DEBT_COLLECTION).doc(debtId).collection('months').doc(month);
      transaction.set(monthlyRef, { minimumPayment: payments[debtId] }, { merge: true });
    }
  });
}
