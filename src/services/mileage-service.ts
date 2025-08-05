
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

export async function getMileageLogs(): Promise<MileageLog[]> {
  const expenseCollection = collection(db, EXPENSE_COLLECTION);
  // Remove the orderBy clause to avoid needing a composite index
  const q = query(expenseCollection, where('type', '==', 'Mileage'));
  const querySnapshot = await getDocs(q);

  const mileageLogs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MileageLog));
  
  // Sort in-memory instead
  return mileageLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function addMileageLog(itemData: Omit<MileageLog, 'id'>): Promise<MileageLog> {
  const docRef = await addDoc(collection(db, EXPENSE_COLLECTION), itemData);
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
