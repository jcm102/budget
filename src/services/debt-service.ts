
'use server';

import { db } from '@/lib/firebase';
import type { Debt } from '@/types';
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
  runTransaction
} from 'firebase/firestore';

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
    // Optionally, you could throw an error here, but for now we'll just log it
    // to prevent the app from crashing.
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
