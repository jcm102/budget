'use server';

import { db } from '@/lib/firebase-admin';
import type { AccountLedgerItem, AccountDetails } from '@/types';

const LEDGER_COLLECTION = 'account-ledger-items';
const ACCOUNTS_COLLECTION = 'transferees'; // Collection where account names/balances live

/**
 * FETCH FUNDS FOR EXPENSE PAGE
 */
export async function getExpenseFunds() {
  try {
    const snapshot = await db.collection(ACCOUNTS_COLLECTION).get();
    const accounts = snapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as AccountDetails));

    // Finding specific accounts by name. 
    // Ensure these names match what you have in your Firestore exactly.
    const honorarium = accounts.find(a => a.name.toLowerCase().includes('honorarium')) || null;
    const reimbursable = accounts.find(a => a.name.toLowerCase().includes('reimbursable')) || null;

    return { honorarium, reimbursable };
  } catch (error) {
    console.error('Error fetching ledger funds:', error);
    throw error;
  }
}

/**
 * LEDGER ITEM CRUD (Using correct Admin SDK syntax)
 */
export async function getLedgerItems(accountId: string): Promise<AccountLedgerItem[]> {
  const snapshot = await db.collection(LEDGER_COLLECTION)
    .where('accountId', '==', accountId)
    .get();
    
  const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountLedgerItem));
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

export async function addLedgerItem(itemData: Omit<AccountLedgerItem, 'id'>): Promise<AccountLedgerItem> {
  const docRef = await db.collection(LEDGER_COLLECTION).add(itemData);
  const docSnap = await docRef.get();
  return { id: docSnap.id, ...(docSnap.data() as Omit<AccountLedgerItem, 'id'>) };
}

export async function updateLedgerItem(id: string, itemData: Partial<Omit<AccountLedgerItem, 'id'>>): Promise<void> {
  await db.collection(LEDGER_COLLECTION).doc(id).update(itemData);
}

export async function deleteLedgerItem(id: string): Promise<void> {
  await db.collection(LEDGER_COLLECTION).doc(id).delete();
}