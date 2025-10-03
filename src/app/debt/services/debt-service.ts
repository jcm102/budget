
'use server';

import { db } from '@/lib/firebase';
import type { Debt, AccountDetails, BudgetItem, Category, DebtType, MonthlyBudgetItem } from '@/types';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc,
  query,
  writeBatch,
  getDoc,
  orderBy,
  updateDoc,
  runTransaction,
  where,
  limit
} from 'firebase/firestore';
import { addMonths, format } from 'date-fns';
import { createAutomatedBackup } from '@/services/backup-service';

const DEBT_COLLECTION = 'debts';

export async function getDebts(): Promise<Debt[]> {
  const debtCollection = collection(db, DEBT_COLLECTION);
  const q = query(debtCollection, orderBy('order'));
  const querySnapshot = await getDocs(q);
  const debts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt));
  return debts;
}

export async function addDebt(debtData: Omit<Debt, 'id' | 'order'>): Promise<Debt> {
  const debtCollectionRef = collection(db, DEBT_COLLECTION);
  const snapshot = await getDocs(query(debtCollectionRef));
  const newOrder = snapshot.size;

  const newDebt: Omit<Debt, 'id'> = { 
    ...debtData, 
    interestRate: debtData.interestRate || 0,
    debtType: debtData.debtType || 'Credit Card',
    order: newOrder, 
    paid: false,
    nextBalance: debtData.nextBalance || 0,
    nextMinimumPayment: debtData.nextMinimumPayment || 0,
    nextDueDate: debtData.nextDueDate,
    nextPaid: false,
    plannedPayment: debtData.plannedPayment || 0,
   };
  const docRef = doc(collection(db, DEBT_COLLECTION));
  await setDoc(docRef, newDebt);
  return { ...newDebt, id: docRef.id };
}

export async function updateDebt(id: string, debtData: Partial<Omit<Debt, 'id' | 'order'>>): Promise<void> {
  const debtRef = doc(db, DEBT_COLLECTION, id);
  const docSnap = await getDoc(debtRef);

  if (docSnap.exists()) {
    await updateDoc(debtRef, debtData);
  } else {
    console.warn(`Attempted to update a debt document that does not exist: ${id}`);
  }
}

export async function addExtraPayment(id: string, amount: number): Promise<void> {
  const debtRef = doc(db, DEBT_COLLECTION, id);
  await runTransaction(db, async (transaction) => {
    const debtDoc = await transaction.get(debtRef);
    if (!debtDoc.exists()) {
      throw "Debt document does not exist!";
    }
    const currentPayment = debtDoc.data().plannedPayment || 0;
    const newPlannedPayment = currentPayment + amount;
    transaction.update(debtRef, { plannedPayment: newPlannedPayment });
  });
}

export async function updateDebtOrder(debts: Debt[]): Promise<void> {
    const batch = writeBatch(db);
    debts.forEach((debt, index) => {
        const debtRef = doc(db, DEBT_COLLECTION, debt.id);
        batch.update(debtRef, { order: index });
    });
    await batch.commit();
}

export async function deleteDebt(id: string): Promise<void> {
  const debtRef = doc(db, DEBT_COLLECTION, id);
  await deleteDoc(debtRef);
}

export async function resetDebtValues(): Promise<void> {
  await createAutomatedBackup('pre-debt-reset');
  const debtCollection = collection(db, DEBT_COLLECTION);
  const q = query(debtCollection);
  const querySnapshot = await getDocs(q);
  const batch = writeBatch(db);

  querySnapshot.forEach(docSnap => {
    const debtRef = doc(db, DEBT_COLLECTION, docSnap.id);
    const updatedData = {
        balance: 0,
        minimumPayment: 0,
        plannedPayment: 0,
        dueDate: new Date().toISOString().split('T')[0],
        paid: false,
        nextBalance: 0,
        nextMinimumPayment: 0,
        nextDueDate: new Date().toISOString().split('T')[0],
        nextPaid: false,
    };
    batch.update(debtRef, updatedData);
  });

  await batch.commit();
}

export async function cycleToNextMonth(): Promise<void> {
  await createAutomatedBackup('pre-debt-cycle');
  const debtCollectionRef = collection(db, DEBT_COLLECTION);
  const snapshot = await getDocs(query(debtCollectionRef));
  const batch = writeBatch(db);

  snapshot.forEach(doc => {
    const debt = doc.data() as Debt;
    const debtRef = doc.ref;

    batch.update(debtRef, {
      balance: debt.nextBalance || 0,
      minimumPayment: debt.nextMinimumPayment || 0,
      dueDate: debt.nextDueDate || new Date().toISOString().split('T')[0],
      paid: debt.nextPaid || false,
      // Clear out the 'next' fields
      nextBalance: 0,
      nextMinimumPayment: 0,
      nextDueDate: new Date().toISOString().split('T')[0],
      nextPaid: false,
    });
  });

  await batch.commit();
}

export async function applyPaymentsToBudget(payments: Record<string, number>): Promise<void> {
    await runTransaction(db, async (transaction) => {
        const debtsSnapshot = await getDocs(query(collection(db, DEBT_COLLECTION)));
        const allDebts = debtsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Debt));

        for (const debtId in payments) {
            const paymentAmount = payments[debtId];
            const debt = allDebts.find(d => d.id === debtId);

            if (!debt || paymentAmount <= 0) continue;

            const debtRef = doc(db, DEBT_COLLECTION, debtId);
            transaction.update(debtRef, { nextMinimumPayment: paymentAmount });
        }
    });
}
