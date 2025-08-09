
'use server';

import { db } from '@/lib/firebase';
import type { MileageLog } from '@/types';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  getDoc,
  addDoc,
  where,
  updateDoc,
} from 'firebase/firestore';

const EXPENSE_COLLECTION = 'expenses'; // We store mileage in the same collection

export async function getMileageLogs(status: 'active' | 'archived', archiveKey?: string): Promise<MileageLog[]> {
  const expenseCollection = collection(db, EXPENSE_COLLECTION);
  let q;

  if (status === 'active') {
     const activeQuery = query(expenseCollection, where('type', '==', 'Mileage'), where('status', '==', 'active'));
     const legacyQuery = query(expenseCollection, where('type', '==', 'Mileage'), where('status', '==', null));
     
     const [activeSnapshot, legacySnapshot] = await Promise.all([
        getDocs(activeQuery),
        getDocs(legacyQuery)
     ]);

     const allItems = [
        ...activeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MileageLog)),
        ...legacySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MileageLog))
     ];

     const uniqueItems = Array.from(new Map(allItems.map(item => [item.id, item])).values());
     return uniqueItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  } else {
     q = query(expenseCollection, where('type', '==', 'Mileage'), where('status', '==', 'archived'), where('archiveKey', '==', archiveKey));
     const querySnapshot = await getDocs(q);
     const mileageLogs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MileageLog));
     return mileageLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export async function addMileageLog(itemData: Omit<MileageLog, 'id'>): Promise<MileageLog> {
  // New mileage logs are always active
  const dataWithStatus = { ...itemData, status: 'active' };
  const docRef = await addDoc(collection(db, EXPENSE_COLLECTION), dataWithStatus);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...docSnap.data() } as MileageLog;
}

export async function updateMileageLog(id: string, itemData: Partial<Omit<MileageLog, 'id'>>): Promise<void> {
  const itemRef = doc(db, EXPENSE_COLLECTION, id);
  await updateDoc(itemRef, itemData);
}

export async function deleteMileageLog(id: string): Promise<void> {
  const itemRef = doc(db, EXPENSE_COLLECTION, id);
  await deleteDoc(itemRef);
}
