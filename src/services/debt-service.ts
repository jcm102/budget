
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
  getDoc
} from 'firebase/firestore';

const DEBT_COLLECTION = 'debts';

export async function getDebts(): Promise<Debt[]> {
  const debtCollection = collection(db, DEBT_COLLECTION);
  const q = query(debtCollection);
  const querySnapshot = await getDocs(q);
  const debts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt));
  return debts;
}

export async function addDebt(debtData: Omit<Debt, 'id'>): Promise<Debt> {
  const newDebt: Omit<Debt, 'id'> = { ...debtData };
  const docRef = doc(collection(db, DEBT_COLLECTION));
  await setDoc(docRef, newDebt);
  return { ...newDebt, id: docRef.id };
}

export async function updateDebt(id: string, debtData: Omit<Debt, 'id'>): Promise<void> {
  const debtRef = doc(db, DEBT_COLLECTION, id);
  // We use set with merge true to avoid overwriting the whole document if we only want to update some fields.
  // In this case, it is a full update, but this is a good practice.
  const docSnap = await getDoc(debtRef);
  if (docSnap.exists()) {
      const existingData = docSnap.data();
      await setDoc(debtRef, { ...existingData, ...debtData });
  } else {
      throw new Error(`Debt with id ${id} not found.`);
  }
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
        ...docSnap.data(),
        balance: 0,
        minimumPayment: 0,
        actualPayment: 0,
        dueDate: new Date().toISOString(),
    };
    batch.set(debtRef, updatedData);
  });

  await batch.commit();
}
