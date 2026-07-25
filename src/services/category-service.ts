'use server';

import { db } from '@/lib/firebase-admin';
import type { Category } from '@/types';

const CATEGORY_COLLECTION = 'income-categories';
const defaultCategories = ['Paycheck', 'Bonus', 'Freelance', 'Other'];

async function seedDefaultCategories() {
  const categoryCol = db.collection(CATEGORY_COLLECTION);
  const snapshot = await categoryCol.limit(1).get();
  
  if (snapshot.empty) {
    const batch = db.batch();
    defaultCategories.forEach(categoryName => {
      const newDocRef = categoryCol.doc();
      batch.set(newDocRef, { name: categoryName });
    });
    await batch.commit();
  }
}

export async function getCategories(): Promise<Category[]> {
  try {
    await seedDefaultCategories();
    const snapshot = await db.collection(CATEGORY_COLLECTION).orderBy('name').get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
  } catch (error) {
    console.error('Error fetching categories:', error);
    // Fallback in case index is building
    const snapshot = await db.collection(CATEGORY_COLLECTION).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
  }
}

export async function addCategory(name: string): Promise<Category> {
  const docRef = await db.collection(CATEGORY_COLLECTION).add({ name });
  const docSnap = await docRef.get();
  return { id: docSnap.id, ...docSnap.data() } as Category;
}

export async function deleteCategory(id: string): Promise<void> {
  await db.collection(CATEGORY_COLLECTION).doc(id).delete();
}