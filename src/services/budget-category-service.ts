
'use server';

import { db } from '@/lib/firebase';
import type { Category } from '@/types';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  orderBy,
  addDoc,
  writeBatch,
  getDoc,
  limit,
  where,
  Query,
} from 'firebase/firestore';

const CATEGORY_COLLECTION = 'budget-categories';
const defaultCategories = ['Groceries', 'Utilities', 'Rent/Mortgage', 'Transportation', 'Entertainment', 'Other', 'Credit Cards', 'Loans', 'Line of Credit'];

async function seedDefaultCategories() {
  const categoryCollectionRef = collection(db, CATEGORY_COLLECTION);
  const snapshot = await getDocs(query(categoryCollectionRef));
  const existingNames = new Set(snapshot.docs.map(doc => doc.data().name));

  const missingCategories = defaultCategories.filter(name => !existingNames.has(name));

  if (missingCategories.length > 0) {
    const batch = writeBatch(db);
    missingCategories.forEach(categoryName => {
      const newDocRef = doc(categoryCollectionRef);
      batch.set(newDocRef, { name: categoryName, parentId: null });
    });
    await batch.commit();
  }
}

export async function getCategories(): Promise<Category[]> {
  await seedDefaultCategories();
  const categoryCollection = collection(db, CATEGORY_COLLECTION);
  const q = query(categoryCollection, orderBy('name'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
}

export async function addCategory(name: string, parentId: string | null = null): Promise<Category> {
  const categoryCollection = collection(db, CATEGORY_COLLECTION);
  const docRef = await addDoc(categoryCollection, { name, parentId });
  const docSnap = await getDoc(docRef);
  const newCategory = { id: docSnap.id, ...docSnap.data() } as Category;
  return newCategory;
}

export async function deleteCategory(id: string): Promise<void> {
  // Check if this category is a parent to any other categories
  const q = query(collection(db, CATEGORY_COLLECTION), where('parentId', '==', id), limit(1));
  const childrenSnapshot = await getDocs(q);
  if (!childrenSnapshot.empty) {
    throw new Error('Cannot delete a category that has subcategories.');
  }

  const categoryRef = doc(db, CATEGORY_COLLECTION, id);
  await deleteDoc(categoryRef);
}
