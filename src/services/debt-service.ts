
'use server';

import { db } from '@/lib/firebase';
import type { Debt, AccountDetails, BudgetItem } from '@/types';
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
  where
} from 'firebase/firestore';

const DEBT_COLLECTION = 'debts';
const ACCOUNT_DETAILS_COLLECTION = 'transferees';
const BUDGET_COLLECTION = 'budget-items';

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
    order: newOrder, 
    paid: false,
    nextBalance: debtData.nextBalance || 0,
    nextMinimumPayment: debtData.nextMinimumPayment || 0,
    nextDueDate: debtData.nextDueDate,
    nextPaid: false,
    actualPayment: debtData.actualPayment || 0,
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
    const currentPayment = debtDoc.data().actualPayment || 0;
    const newActualPayment = currentPayment + amount;
    transaction.update(debtRef, { actualPayment: newActualPayment });
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
  const debtCollection = collection(db, DEBT_COLLECTION);
  const q = query(debtCollection);
  const querySnapshot = await getDocs(q);
  const batch = writeBatch(db);

  querySnapshot.forEach(docSnap => {
    const debtRef = doc(db, DEBT_COLLECTION, docSnap.id);
    const updatedData = {
        balance: 0,
        minimumPayment: 0,
        actualPayment: 0,
        dueDate: new Date().toISOString(),
        paid: false,
        nextBalance: 0,
        nextMinimumPayment: 0,
        nextDueDate: new Date().toISOString(),
        nextPaid: false,
    };
    batch.update(debtRef, updatedData);
  });

  await batch.commit();
}


export async function cycleToNextMonth(): Promise<void> {
    const debtCollection = collection(db, DEBT_COLLECTION);
    const q = query(debtCollection);
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);

    querySnapshot.forEach(docSnap => {
        const debtRef = doc(db, DEBT_COLLECTION, docSnap.id);
        const debt = docSnap.data() as Debt;

        const updatedData = {
            // Move next month's data to current month
            balance: debt.nextBalance || 0,
            minimumPayment: debt.nextMinimumPayment || 0,
            actualPayment: 0, // Reset actual payment for the new month
            dueDate: debt.nextDueDate || new Date().toISOString(),
            paid: false,

            // Reset next month's data
            nextBalance: 0,
            nextMinimumPayment: 0,
            nextDueDate: new Date().toISOString(),
            nextPaid: false
        };
        batch.update(debtRef, updatedData);
    });

    await batch.commit();
}

export async function applyPaymentsToBudget(payments: Record<string, number>): Promise<void> {
    const batch = writeBatch(db);

    // 1. Get all credit accounts and all debts
    const accountsQuery = query(collection(db, ACCOUNT_DETAILS_COLLECTION), where('type', '==', 'Credit'));
    const debtsQuery = query(collection(db, DEBT_COLLECTION));
    const [accountsSnapshot, debtsSnapshot] = await Promise.all([getDocs(accountsQuery), getDocs(debtsQuery)]);
    
    const allDebts = debtsSnapshot.docs.map(d => ({id: d.id, ...d.data()} as Debt));
    const creditAccounts = accountsSnapshot.docs.map(a => ({id: a.id, ...a.data()} as AccountDetails));

    // 2. Clear existing debt payments from budget
    const existingBudgetPaymentsQuery = query(collection(db, BUDGET_COLLECTION), where('type', '==', 'Debt Payments'));
    const existingBudgetPaymentsSnapshot = await getDocs(existingBudgetPaymentsQuery);
    existingBudgetPaymentsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // 3. Update debts and create new budget items
    for (const debtId in payments) {
        const paymentAmount = payments[debtId];
        const debt = allDebts.find(d => d.id === debtId);
        
        if (!debt) {
            console.warn(`Debt with ID ${debtId} not found while applying schedule.`);
            continue;
        }

        // Update the actual payment on the debt worksheet
        const debtRef = doc(db, DEBT_COLLECTION, debtId);
        batch.update(debtRef, { actualPayment: paymentAmount });
        
        // Find the linked credit account
        const linkedAccount = creditAccounts.find(acc => acc.linkedDebtId === debtId);
        
        if (!linkedAccount) {
             console.warn(`No credit account linked to debt "${debt.name}". Cannot create budget item.`);
             continue;
        }
        
        // Create a new budget item
        const budgetItemData: Omit<BudgetItem, 'id'> = {
            type: 'Debt Payments',
            description: `${debt.name} Payment`,
            amount: paymentAmount,
            date: new Date().toISOString(), 
            frequency: 'One-Time',
            category: 'N/A', // Or another default
            completed: false,
            transferFrom: linkedAccount.name, // The name of the credit account
            transferTo: '', // This might not be relevant for debt payments
        };

        const newDocRef = doc(collection(db, BUDGET_COLLECTION));
        batch.set(newDocRef, budgetItemData);
    }
    
    await batch.commit();
}
