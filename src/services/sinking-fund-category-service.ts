
'use server';

import { db } from '@/lib/firebase-admin';
import type { Category } from '@/types';
import { collection, getDocs, doc, deleteDoc, query, orderBy, addDoc, writeBatch, getDoc, limit, Firestore } from 'firebase/firestore';

const CATEGORY_COLLECTION = 'sinking-fund-categories';
const defaultCategories = ['Personal Care', 'Auto', 'Home', 'Health', 'Gifts', 'Other'];

async function seedDefaultCategories(db: Firestore) {
  const categoryCollectionRef = collection(db, CATEGORY_COLLECTION);
  const q = query(categoryCollectionRef, limit(1));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    const batch = writeBatch(db);
    defaultCategories.forEach(categoryName => {
      const newDocRef = doc(categoryCollectionRef);
      batch.set(newDocRef, { name: categoryName });
    });
    await batch.commit();
  }
}

export async function getCategories(db: Firestore): Promise<Category[]> {
  await seedDefaultCategories(db);
  const categoryCollection = collection(db, CATEGORY_COLLECTION);
  const q = query(categoryCollection, orderBy('name'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
}

export async function addCategory(db: Firestore, name: string): Promise<Category> {
  const categoryCollection = collection(db, CATEGORY_COLLECTION);
  const docRef = await addDoc(categoryCollection, { name });
  const docSnap = await getDoc(docRef);
  const newCategory = { id: docSnap.id, ...docSnap.data() } as Category;
  return newCategory;
}

export async function deleteCategory(db: Firestore, id: string): Promise<void> {
  const categoryRef = doc(db, CATEGORY_COLLECTION, id);
  await deleteDoc(categoryRef);
}
