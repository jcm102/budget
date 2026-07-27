'use server';

import { db } from '@/lib/firebase-admin';

const COLLECTION = 'sinking-fund-categories';

export async function getCategories() {
  try {
    const snapshot = await db.collection(COLLECTION).get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

export async function addCategory(name: string) {
  await db.collection(COLLECTION).add({ name });
}

export async function deleteCategory(id: string) {
  await db.collection(COLLECTION).doc(id).delete();
}