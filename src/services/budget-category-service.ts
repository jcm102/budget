
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
const BUDGET_ITEMS_COLLECTION = 'monthly-budget-items';
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

const findAllDescendantIds = (categoryId: string, allCategories: Category[]): string[] => {
    const children = allCategories.filter(c => c.parentId === categoryId);
    let descendantIds: string[] = [];
    for (const child of children) {
        descendantIds.push(child.id);
        descendantIds = [...descendantIds, ...findAllDescendantIds(child.id, allCategories)];
    }
    return descendantIds;
};

export async function deleteCategory(id: string): Promise<void> {
  const batch = writeBatch(db);
  
  // Fetch all categories to build the hierarchy in memory
  const allCategoriesSnapshot = await getDocs(collection(db, CATEGORY_COLLECTION));
  const allCategories = allCategoriesSnapshot.docs.map(d => ({id: d.id, ...d.data()}) as Category);
  
  const idsToDelete = [id, ...findAllDescendantIds(id, allCategories)];

  // Delete all categories and subcategories
  idsToDelete.forEach(categoryId => {
    const categoryRef = doc(db, CATEGORY_COLLECTION, categoryId);
    batch.delete(categoryRef);
  });

  // Delete associated monthly budget items.
  // Firestore `in` query is limited to 30 items, so we might need to batch this.
  for (let i = 0; i < idsToDelete.length; i += 30) {
    const chunk = idsToDelete.slice(i, i + 30);
    if (chunk.length > 0) {
        const budgetItemsQuery = query(collection(db, BUDGET_ITEMS_COLLECTION), where('categoryId', 'in', chunk));
        const budgetItemsSnapshot = await getDocs(budgetItemsQuery);
        budgetItemsSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
    }
  }

  await batch.commit();
}
