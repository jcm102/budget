
'use server';

import { db } from '@/lib/firebase-admin';
import type { AccountLedgerItem } from '@/types';
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
  where,
  Firestore
} from 'firebase/firestore';

const LEDGER_COLLECTION = 'account-ledger-items';

export async function getLedgerItems(db: Firestore, accountId: string): Promise<AccountLedgerItem[]> {
  const ledgerCollection = collection(db, LEDGER_COLLECTION);
  const q = query(ledgerCollection, where('accountId', '==', accountId));
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountLedgerItem));
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function addLedgerItem(db: Firestore, itemData: Omit<AccountLedgerItem, 'id'>): Promise<AccountLedgerItem> {
  const docRef = await addDoc(collection(db, LEDGER_COLLECTION), itemData);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<AccountLedgerItem, 'id'>) };
}

export async function updateLedgerItem(db: Firestore, id: string, itemData: Partial<Omit<AccountLedgerItem, 'id'>>): Promise<void> {
  const itemRef = doc(db, LEDGER_COLLECTION, id);
  await updateDoc(itemRef, itemData);
}

export async function deleteLedgerItem(db: Firestore, id: string): Promise<void> {
  const itemRef = doc(db, LEDGER_COLLECTION, id);
  await deleteDoc(itemRef);
}
