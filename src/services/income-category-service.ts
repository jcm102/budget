
'use server';

import { Firestore, collection, getDocs, doc, deleteDoc, query, orderBy, addDoc, writeBatch, getDoc, limit, where } from 'firebase/firestore';
import type { Category } from '@/types';

const CATEGORY_COLLECTION = 'income-categories';
const defaultCategories = ['Paycheck', 'Bonus', 'Freelance', 'Other'];

async function seedDefaultCategories(db: Firestore) {
  const categoryCollectionRef = collection(db, CATEGORY_COLLECTION);
  
  // Check if default categories are already seeded
  const q = query(collection(db, CATEGORY_COLLECTION), where('name', 'in', defaultCategories));
  const snapshot = await getDocs(q);
  const existingNames = snapshot.docs.map(doc => doc.data().name);
  
  const missingCategories = defaultCategories.filter(name => !existingNames.includes(name));

  if (missingCategories.length > 0) {
    const batch = writeBatch(db);
    missingCategories.forEach(categoryName => {
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
