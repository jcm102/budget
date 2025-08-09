
'use server';

import { db } from '@/lib/firebase';
import type { AutoShipItem, AutoShipFrequency } from '@/types';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  updateDoc,
  addDoc,
  getDoc,
  orderBy,
} from 'firebase/firestore';
import { addMonths } from 'date-fns';

const AUTOSHIP_COLLECTION = 'autoship-items';

const frequencyMap: Record<AutoShipFrequency, number> = {
    'Monthly': 1,
    'Every 2 Months': 2,
    'Every 3 Months': 3,
    'Every 4 Months': 4,
    'Every 6 Months': 6,
};

export async function getAutoShipItems(): Promise<AutoShipItem[]> {
  const autoShipCollection = collection(db, AUTOSHIP_COLLECTION);
  const q = query(autoShipCollection, orderBy('nextShipmentDate'));
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AutoShipItem));
  return items;
}

export async function addAutoShipItem(itemData: Omit<AutoShipItem, 'id'>): Promise<AutoShipItem> {
  const docRef = await addDoc(collection(db, AUTOSHIP_COLLECTION), itemData);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<AutoShipItem, 'id'>) };
}

export async function updateAutoShipItem(id: string, itemData: Partial<Omit<AutoShipItem, 'id'>>): Promise<void> {
  const itemRef = doc(db, AUTOSHIP_COLLECTION, id);
  await updateDoc(itemRef, itemData);
}

export async function deleteAutoShipItem(id: string): Promise<void> {
  const itemRef = doc(db, AUTOSHIP_COLLECTION, id);
  await deleteDoc(itemRef);
}

export async function advanceShipmentDate(id: string): Promise<void> {
    const itemRef = doc(db, AUTOSHIP_COLLECTION, id);
    const docSnap = await getDoc(itemRef);

    if (!docSnap.exists()) {
        throw new Error('Auto-ship item not found');
    }

    const item = docSnap.data() as AutoShipItem;
    const monthsToAdd = frequencyMap[item.frequency];
    const newShipmentDate = addMonths(new Date(item.nextShipmentDate), monthsToAdd);

    await updateDoc(itemRef, {
        nextShipmentDate: newShipmentDate.toISOString(),
    });
}
