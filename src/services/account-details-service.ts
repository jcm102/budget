'use server';

import { db } from '@/lib/firebase-admin';
import type { AccountDetails, Debt, AccountLedgerItem } from '@/types';

const ACCOUNT_DETAILS_COLLECTION = 'transferees'; 
const DEBT_COLLECTION = 'debts';
const LEDGER_ITEMS_COLLECTION = 'account-ledger-items';

export async function getAccounts(): Promise<AccountDetails[]> {
  const [accountSnapshot, debtSnapshot, ledgerSnapshot] = await Promise.all([
    db.collection(ACCOUNT_DETAILS_COLLECTION).orderBy('name').get(),
    db.collection(DEBT_COLLECTION).get(),
    db.collection(LEDGER_ITEMS_COLLECTION).get()
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

  return accountSnapshot.docs.map(doc => {
    const account = { id: doc.id, ...doc.data() } as AccountDetails;
    if (account.isCalculated) {
        const items = ledgerItemsByAccount.get(account.id) || [];
        account.balance = items.reduce((sum, item) => sum + item.amount, 0);
    } else if (account.type === 'Credit' && account.linkedDebtId && debtsMap.has(account.linkedDebtId)) {
        account.balance = debtsMap.get(account.linkedDebtId)!.balance;
    }
    return account;
  });
}

export async function addAccount(accountData: Omit<AccountDetails, 'id'>) {
  const docRef = await db.collection(ACCOUNT_DETAILS_COLLECTION).add(accountData);
  return { id: docRef.id };
}

export async function updateAccount(id: string, data: any) {
  await db.collection(ACCOUNT_DETAILS_COLLECTION).doc(id).update(data);
}

export async function deleteAccount(id: string) {
  await db.collection(ACCOUNT_DETAILS_COLLECTION).doc(id).delete();
}