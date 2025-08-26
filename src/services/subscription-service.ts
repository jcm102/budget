
'use server';

import { db } from '@/lib/firebase';
import type { SubscriptionItem } from '@/types';
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
  where
} from 'firebase/firestore';

const SUBSCRIPTION_COLLECTION = 'subscriptions';

export async function getSubscriptions(accountId: string): Promise<SubscriptionItem[]> {
  const subCollection = collection(db, SUBSCRIPTION_COLLECTION);
  const q = query(subCollection, where('accountId', '==', accountId));
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubscriptionItem));
  return items.sort((a, b) => a.serviceName.localeCompare(b.serviceName));
}

export async function addSubscription(itemData: Omit<SubscriptionItem, 'id'>): Promise<SubscriptionItem> {
  const docRef = await addDoc(collection(db, SUBSCRIPTION_COLLECTION), itemData);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<SubscriptionItem, 'id'>) };
}

export async function updateSubscription(id: string, itemData: Partial<Omit<SubscriptionItem, 'id'>>): Promise<void> {
  const itemRef = doc(db, SUBSCRIPTION_COLLECTION, id);
  await updateDoc(itemRef, itemData);
}

export async function deleteSubscription(id: string): Promise<void> {
  const itemRef = doc(db, SUBSCRIPTION_COLLECTION, id);
  await deleteDoc(itemRef);
}
