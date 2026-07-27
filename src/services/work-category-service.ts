'use server';

import { db } from '@/lib/firebase-admin';
import type { Category } from '@/types';

const CATEGORY_COLLECTION = 'work-expense-categories';
const defaultCategories = ['Travel', 'Meals', 'Office Supplies', 'Software', 'Church Expense', 'Other'];

async function seedDefaultCategories() {
  const snapshot = await db.collection(CATEGORY_COLLECTION).limit(1).get();
  if (snapshot.empty) {
    const batch = db.batch();
    defaultCategories.forEach(categoryName => {
      const newDocRef = db.collection(CATEGORY_COLLECTION).doc();
      batch.set(newDocRef, { name: categoryName });
    });
    await batch.commit();
  }
}

export async function getCategories(): Promise<Category[]> {
  await seedDefaultCategories();
  const querySnapshot = await db.collection(CATEGORY_COLLECTION).orderBy('name').get();
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
}

export async function addCategory(name: string): Promise<Category> {
  const docRef = await db.collection(CATEGORY_COLLECTION).add({ name });
  const docSnap = await docRef.get();
  return { id: docSnap.id, ...docSnap.data() } as Category;
}

export async function deleteCategory(id: string): Promise<void> {
  await db.collection(CATEGORY_COLLECTION).doc(id).delete();
}
