
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

// Recursive function to find all descendant IDs
const findAllDescendantIds = async (categoryId: string): Promise<string[]> => {
    let descendantIds: string[] = [];
    const q = query(collection(db, CATEGORY_COLLECTION), where('parentId', '==', categoryId));
    const childrenSnapshot = await getDocs(q);

    if (childrenSnapshot.empty) {
        return [];
    }

    for (const childDoc of childrenSnapshot.docs) {
        descendantIds.push(childDoc.id);
        const grandChildrenIds = await findAllDescendantIds(childDoc.id);
        descendantIds = descendantIds.concat(grandChildrenIds);
    }

    return descendantIds;
};


export async function deleteCategory(id: string): Promise<void> {
  const batch = writeBatch(db);

  // Find all descendants and add them to the batch for deletion
  const descendantIds = await findAllDescendantIds(id);
  descendantIds.forEach(descendantId => {
    const descendantRef = doc(db, CATEGORY_COLLECTION, descendantId);
    batch.delete(descendantRef);
  });

  // Delete the parent category itself
  const categoryRef = doc(db, CATEGORY_COLLECTION, id);
  batch.delete(categoryRef);

  await batch.commit();
}
