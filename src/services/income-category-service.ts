'use server';

import { db } from '@/lib/firebase-admin';
import type { Category } from '@/types';

const CATEGORY_COLLECTION = 'income-categories';
const defaultCategories = ['Paycheck', 'Bonus', 'Freelance', 'Other'];

async function seedDefaultCategories() {
  const seedFlagRef = db.collection(CATEGORY_COLLECTION).doc('_seeded');
  const seedFlagSnap = await seedFlagRef.get();
  if (seedFlagSnap.exists) return;

  const snapshot = await db.collection(CATEGORY_COLLECTION).limit(2).get();
  const hasExisting = snapshot.docs.some(doc => doc.id !== '_seeded');

  const batch = db.batch();
  if (!hasExisting) {
    defaultCategories.forEach(categoryName => {
      const newDocRef = db.collection(CATEGORY_COLLECTION).doc();
      batch.set(newDocRef, { name: categoryName });
    });
  }
  batch.set(seedFlagRef, { seeded: true });
  await batch.commit();
}

export async function getCategories(): Promise<Category[]> {
  await seedDefaultCategories();
  const querySnapshot = await db.collection(CATEGORY_COLLECTION).orderBy('name').get();
  return querySnapshot.docs
    .filter(doc => doc.id !== '_seeded')
    .map(doc => ({ id: doc.id, ...doc.data() } as Category));
}

export async function addCategory(name: string): Promise<Category> {
  const docRef = await db.collection(CATEGORY_COLLECTION).add({ name });
  const docSnap = await docRef.get();
  return { id: docSnap.id, ...docSnap.data() } as Category;
}

export async function deleteCategory(id: string): Promise<void> {
  await db.collection(CATEGORY_COLLECTION).doc(id).delete();
}
