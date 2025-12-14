
'use client';

import { db } from '@/lib/firebase';
import type { Account, SavingsItem, Goal, AccountLedgerItem } from '@/types';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  orderBy,
  addDoc,
  getDoc,
  writeBatch,
  where,
  updateDoc,
} from 'firebase/firestore';

const ACCOUNT_COLLECTION = 'accounts';
const SINKING_FUNDS_COLLECTION = 'sinking-funds';
const GOALS_COLLECTION = 'goals';
const LEDGER_ITEMS_COLLECTION = 'account-ledger-items';
const SUBSCRIPTIONS_COLLECTION = 'subscriptions';
const AUTOSHIP_COLLECTION = 'autoship-items';

const defaultAccounts = ['Primary Account', 'Future Expenses', 'Reimbursable Expenses'];

async function seedDefaultAccounts() {
  const accountCollectionRef = collection(db, ACCOUNT_COLLECTION);
  const snapshot = await getDocs(query(accountCollectionRef));
  
  if (snapshot.empty) {
    const batch = writeBatch(db);
    defaultAccounts.forEach(accountName => {
      const newDocRef = doc(accountCollectionRef);
      batch.set(newDocRef, { name: accountName });
    });
    await batch.commit();
  }
}

async function migrateOrphanedItems(defaultAccountId: string) {
    const batch = writeBatch(db);
    const collectionsToMigrate = [SINKING_FUNDS_COLLECTION, GOALS_COLLECTION, LEDGER_ITEMS_COLLECTION, SUBSCRIPTIONS_COLLECTION, AUTOSHIP_COLLECTION];

    for (const coll of collectionsToMigrate) {
        // Fetch all documents in the collection and filter client-side
        const allDocsSnapshot = await getDocs(collection(db, coll));
        allDocsSnapshot.forEach(docSnap => {
            const data = docSnap.data();
            // If accountId field does not exist, it's an orphan
            if (!data.accountId) {
                batch.update(docSnap.ref, { accountId: defaultAccountId });
            }
        });
    }
    await batch.commit();
}

export async function getAccounts(): Promise<Account[]> {
  await seedDefaultAccounts();
  const accountCollection = collection(db, ACCOUNT_COLLECTION);
  const q = query(accountCollection, orderBy('name'));
  const querySnapshot = await getDocs(q);

  const accounts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));

  // After getting accounts, ensure one is default and migrate any orphans
  if (accounts.length > 0) {
      await migrateOrphanedItems(accounts[0].id);
  }

  return accounts;
}

export async function addAccount(name: string): Promise<Account> {
  const accountCollection = collection(db, ACCOUNT_COLLECTION);
  const docRef = await addDoc(accountCollection, { name });
  const docSnap = await getDoc(docRef);
  const newAccount = { id: docSnap.id, ...docSnap.data() } as Account;
  return newAccount;
}

export async function updateAccount(id: string, name: string): Promise<void> {
    const accountRef = doc(db, ACCOUNT_COLLECTION, id);
    await updateDoc(accountRef, { name });
}

export async function deleteAccount(id: string): Promise<void> {
  const batch = writeBatch(db);

  // Delete the account document itself
  const accountRef = doc(db, ACCOUNT_COLLECTION, id);
  batch.delete(accountRef);

  // Find and delete all items associated with this account
  const collectionsToDeleteFrom = [SINKING_FUNDS_COLLECTION, GOALS_COLLECTION, LEDGER_ITEMS_COLLECTION, SUBSCRIPTIONS_COLLECTION, AUTOSHIP_COLLECTION];
  for (const coll of collectionsToDeleteFrom) {
    const q = query(collection(db, coll), where('accountId', '==', id));
    const snapshot = await getDocs(q);
    snapshot.forEach(docSnap => {
      batch.delete(docSnap.ref);
    });
  }

  await batch.commit();
}
