'use server';

import { db } from '@/lib/firebase-admin';
import type { Category } from '@/types';

const CATEGORY_COLLECTION = 'budget-categories';
const BUDGET_ITEMS_COLLECTION = 'monthly-budget-items';
const defaultCategories = ['Groceries', 'Utilities', 'Rent/Mortgage', 'Transportation', 'Entertainment', 'Other', 'Credit Cards', 'Loans', 'Line of Credit'];

async function seedDefaultCategories() {
  const seedFlagRef = db.collection(CATEGORY_COLLECTION).doc('_seeded');
  const seedFlagSnap = await seedFlagRef.get();
  if (seedFlagSnap.exists) return;

  const batch = db.batch();
  defaultCategories.forEach(categoryName => {
    const newDocRef = db.collection(CATEGORY_COLLECTION).doc();
    batch.set(newDocRef, { name: categoryName, parentId: null });
  });
  batch.set(seedFlagRef, { seeded: true });
  await batch.commit();
}

export async function getCategories(): Promise<Category[]> {
  await seedDefaultCategories();
  const querySnapshot = await db.collection(CATEGORY_COLLECTION).get();
  const categories = querySnapshot.docs
    .filter(doc => doc.id !== '_seeded')
    .map(doc => ({ id: doc.id, ...doc.data() } as Category));
  return categories.sort((a, b) => a.name.localeCompare(b.name));
}

export async function addCategory(name: string, parentId: string | null = null): Promise<Category> {
  const docRef = await db.collection(CATEGORY_COLLECTION).add({ name, parentId });
  const docSnap = await docRef.get();
  return { id: docSnap.id, ...docSnap.data() } as Category;
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
  const batch = db.batch();

  const allCategoriesSnapshot = await db.collection(CATEGORY_COLLECTION).get();
  const allCategories = allCategoriesSnapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Category);

  const idsToDelete = [id, ...findAllDescendantIds(id, allCategories)];

  idsToDelete.forEach(categoryId => {
    batch.delete(db.collection(CATEGORY_COLLECTION).doc(categoryId));
  });

  // Delete associated budget items in chunks of 30 (Firestore 'in' limit)
  for (let i = 0; i < idsToDelete.length; i += 30) {
    const chunk = idsToDelete.slice(i, i + 30);
    if (chunk.length > 0) {
      const budgetItemsSnapshot = await db.collection(BUDGET_ITEMS_COLLECTION)
        .where('categoryId', 'in', chunk)
        .get();
      budgetItemsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
    }
  }

  await batch.commit();
}

export async function updateCategory(id: string, data: Partial<Category>): Promise<void> {
  await db.collection(CATEGORY_COLLECTION).doc(id).update(data);
}
