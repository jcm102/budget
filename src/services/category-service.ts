
'use server';

import { db } from '@/lib/firebase';
import type { IncomeCategory } from '@/types';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc,
  query
} from 'firebase/firestore';

const CATEGORY_COLLECTION = 'income-categories';

const defaultCategories = ['Paycheck', 'Bonus', 'Freelance', 'Other'];

export async function getCategories(): Promise<IncomeCategory[]> {
  const categoryCollection = collection(db, CATEGORY_COLLECTION);
  const q = query(categoryCollection);
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    const batch = setDoc;
    const itemsWithIds: IncomeCategory[] = [];
    for (const catName of defaultCategories) {
        const docRef = doc(categoryCollection);
        await setDoc(docRef, { name: catName });
        itemsWithIds.push({ id: docRef.id, name: catName });
    }
    return itemsWithIds;
  }
  
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as IncomeCategory));
  return items;
}

export async function addCategory(itemData: Omit<IncomeCategory, 'id'>): Promise<IncomeCategory> {
  const docRef = doc(collection(db, CATEGORY_COLLECTION));
  await setDoc(docRef, itemData);
  return { ...itemData, id: docRef.id };
}

export async function deleteCategory(id: string): Promise<void> {
  const itemRef = doc(db, CATEGORY_COLLECTION, id);
  await deleteDoc(itemRef);
}
