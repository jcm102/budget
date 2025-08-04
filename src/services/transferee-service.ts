'use server';

import { db } from '@/lib/firebase';
import type { Transferee } from '@/types';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  orderBy,
  addDoc,
  writeBatch,
  limit,
} from 'firebase/firestore';

const TRANSFEREE_COLLECTION = 'transferees';
const defaultTransferees = ['Checking Account', 'Savings Account', 'Credit Card', 'Venmo', 'PayPal'];

async function seedDefaultTransferees() {
  const transfereeCollectionRef = collection(db, TRANSFEREE_COLLECTION);
  const q = query(transfereeCollectionRef, limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    const batch = writeBatch(db);
    defaultTransferees.forEach(transfereeName => {
      const newDocRef = doc(transfereeCollectionRef);
      batch.set(newDocRef, { name: transfereeName });
    });
    await batch.commit();
  }
}

export async function getTransferees(): Promise<Transferee[]> {
  await seedDefaultTransferees();
  const transfereeCollection = collection(db, TRANSFEREE_COLLECTION);
  const q = query(transfereeCollection, orderBy('name'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transferee));
}

export async function addTransferee(name: string): Promise<Transferee> {
  const transfereeCollection = collection(db, TRANSFEREE_COLLECTION);
  const docRef = await addDoc(transfereeCollection, { name });
  return { id: docRef.id, name };
}

export async function deleteTransferee(id: string): Promise<void> {
  const transfereeRef = doc(db, TRANSFEREE_COLLECTION, id);
  await deleteDoc(transfereeRef);
}
