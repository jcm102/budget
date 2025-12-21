
'use server';

import { Firestore, collection, getDocs, doc, deleteDoc, query, orderBy, addDoc, writeBatch, limit, updateDoc, where } from 'firebase/firestore';
import type { AccountDetails, Debt, AccountLedgerItem } from '@/types';
import { db } from '@/lib/firebase-admin';

const ACCOUNT_DETAILS_COLLECTION = 'transferees'; // Keeping the old collection name to avoid data loss
const DEBT_COLLECTION = 'debts';
const LEDGER_ITEMS_COLLECTION = 'account-ledger-items';

const defaultAccounts = [
    { name: 'Chequing Account', type: 'Chequing', balance: 0, isCalculated: false },
    { name: 'Savings Account', type: 'Savings', balance: 0, isCalculated: false },
    { name: 'Credit Card', type: 'Credit', balance: 0, isCalculated: false },
    { name: 'EQ Reimbursable Expenses', type: 'Chequing', balance: 0, isCalculated: true },
];

async function seedDefaultAccounts(db: Firestore) {
  const accountCollectionRef = collection(db, ACCOUNT_DETAILS_COLLECTION);
  const q = query(accountCollectionRef, limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    const batch = writeBatch(db);
    defaultAccounts.forEach(account => {
      const newDocRef = doc(accountCollectionRef);
      batch.set(newDocRef, account);
    });
    await batch.commit();
  }
}

export async function getAccounts(db: Firestore): Promise<AccountDetails[]> {
  await seedDefaultAccounts(db);
  
  const accountCollection = collection(db, ACCOUNT_DETAILS_COLLECTION);
  const debtCollection = collection(db, DEBT_COLLECTION);
  const ledgerCollection = collection(db, LEDGER_ITEMS_COLLECTION);

  const [accountSnapshot, debtSnapshot, ledgerSnapshot] = await Promise.all([
    getDocs(query(accountCollection, orderBy('name'))),
    getDocs(query(debtCollection)),
    getDocs(query(ledgerCollection))
  ]);
  
  const debtsMap = new Map(debtSnapshot.docs.map(doc => [doc.id, doc.data() as Debt]));
  const ledgerItemsByAccount = new Map<string, AccountLedgerItem[]>();

  ledgerSnapshot.forEach(doc => {
      const item = doc.data() as AccountLedgerItem;
      if (!ledgerItemsByAccount.has(item.accountId)) {
          ledgerItemsByAccount.set(item.accountId, []);
      }
      ledgerItemsByAccount.get(item.accountId)!.push(item);
  });


  const accounts = accountSnapshot.docs.map(doc => {
    const account = { id: doc.id, ...doc.data() } as AccountDetails;
    
    if (account.isCalculated) {
        const items = ledgerItemsByAccount.get(account.id) || [];
        account.balance = items.reduce((sum, item) => sum + item.amount, 0);
    } else if (account.type === 'Credit' && account.linkedDebtId && debtsMap.has(account.linkedDebtId)) {
        account.balance = debtsMap.get(account.linkedDebtId)!.balance;
    }
    return account;
  });

  return accounts;
}

export async function addAccount(db: Firestore, accountData: Omit<AccountDetails, 'id'>): Promise<AccountDetails> {
  const accountCollection = collection(db, ACCOUNT_DETAILS_COLLECTION);
  const docRef = await addDoc(accountCollection, accountData);
  return { id: docRef.id, ...accountData };
}

export async function updateAccount(db: Firestore, id: string, accountData: Partial<Omit<AccountDetails, 'id'>>): Promise<void> {
    const accountRef = doc(db, ACCOUNT_DETAILS_COLLECTION, id);
    await updateDoc(accountRef, accountData);
}

export async function deleteAccount(db: Firestore, id: string): Promise<void> {
  const accountRef = doc(db, ACCOUNT_DETAILS_COLLECTION, id);
  await deleteDoc(accountRef);
}
