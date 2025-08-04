'use server';

import { db } from '@/lib/firebase';
import type { Category } from '@/types';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  addDoc,
} from 'firebase/firestore';

const CATEGORY_COLLECTION = 'income-categories';
const defaultCategories = ['Paycheck', 'Bonus', 'Freelance', 'Other'];

async function seedDefaultCategories() {
  const categoryCollection = collection(db, CATEGORY_COLLECTION);
  const snapshot = await getDocs(query(categoryCollection));
  if (snapshot.empty) {
    const batch = setDoc;
    for (const categoryName of defaultCategories) {
      const docRef = doc(categoryCollection);
      await setDoc(docRef, { name: categoryName });
    }
  }
}

export async function getCategories(): Promise<Category[]> {
  await seedDefaultCategories();
  const categoryCollection = collection(db, CATEGORY_COLLECTION);
  const q = query(categoryCollection, orderBy('name'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
}

export async function addCategory(name: string): Promise<Category> {
  const categoryCollection = collection(db, CATEGORY_COLLECTION);
  const docRef = await addDoc(categoryCollection, { name });
  return { id: docRef.id, name };
}

export async function deleteCategory(id: string): Promise<void> {
  const categoryRef = doc(db, CATEGORY_COLLECTION, id);
  await deleteDoc(categoryRef);
}
