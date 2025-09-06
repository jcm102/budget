

'use server';

import { db } from '@/lib/firebase';
import type { MonthlyBudgetItem, Transaction, TransactionSplit } from '@/types';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  addDoc,
  getDoc,
  query,
  where,
  orderBy,
  runTransaction,
  deleteDoc
} from 'firebase/firestore';

const BUDGET_ITEMS_COLLECTION = 'monthly-budget-items';
const TRANSACTIONS_COLLECTION = 'transactions';
const ACCOUNTS_COLLECTION = 'transferees';

// ===== Budget Items =====

export async function getBudgetForMonth(month: string): Promise<MonthlyBudgetItem[]> {
  const q = query(collection(db, BUDGET_ITEMS_COLLECTION), where('month', '==', month));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MonthlyBudgetItem));
}

export async function addBudgetItem(itemData: Omit<MonthlyBudgetItem, 'id'>): Promise<MonthlyBudgetItem> {
  const docRef = await addDoc(collection(db, BUDGET_ITEMS_COLLECTION), itemData);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<MonthlyBudgetItem, 'id'>) };
}

export async function updateBudgetItem(id: string, itemData: Partial<Omit<MonthlyBudgetItem, 'id'>>): Promise<void> {
  const itemRef = doc(db, BUDGET_ITEMS_COLLECTION, id);
  // The hook now calculates the total, so we just need to save it.
  await updateDoc(itemRef, itemData);
}

// ===== Transactions =====

async function adjustAccountBalance(
    transaction: FirebaseFirestore.Transaction,
    accountId: string,
    amount: number,
    operation: 'add' | 'subtract'
) {
    const accountRef = doc(db, ACCOUNTS_COLLECTION, accountId);
    const accountSnap = await transaction.get(accountRef);
    if (!accountSnap.exists()) {
        throw new Error(`Account with ID ${accountId} not found.`);
    }
    const currentBalance = accountSnap.data().balance || 0;
    const newBalance = operation === 'add' ? currentBalance + amount : currentBalance - amount;
    transaction.update(accountRef, { balance: newBalance });
}

export async function getTransactionsForMonth(month: string): Promise<Transaction[]> {
  const startDate = new Date(`${month}-01T00:00:00.000Z`);
  const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
  
  const q = query(
    collection(db, TRANSACTIONS_COLLECTION), 
    where('date', '>=', startDate.toISOString()),
    where('date', '<', endDate.toISOString()),
    orderBy('date', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
}


export async function addTransaction(transactionData: Omit<Transaction, 'id'>): Promise<Transaction> {
    const newDocRef = await runTransaction(db, async (transaction) => {
        const newTransactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
        transaction.set(newTransactionRef, transactionData);

        if (transactionData.type === 'expense' && transactionData.accountId) {
            await adjustAccountBalance(transaction, transactionData.accountId, transactionData.amount, 'subtract');
        } else if (transactionData.type === 'transfer' && transactionData.transferFromId && transactionData.transferToId) {
            await adjustAccountBalance(transaction, transactionData.transferFromId, transactionData.amount, 'subtract');
            await adjustAccountBalance(transaction, transactionData.transferToId, transactionData.amount, 'add');
        }
        return newTransactionRef;
    });

    const docSnap = await getDoc(newDocRef);
    return { id: docSnap.id, ...(docSnap.data() as Omit<Transaction, 'id'>) };
}

export async function updateTransaction(id: string, transactionData: Partial<Omit<Transaction, 'id'>>): Promise<void> {
    await runTransaction(db, async (transaction) => {
        const transactionRef = doc(db, TRANSACTIONS_COLLECTION, id);
        const transactionSnap = await transaction.get(transactionRef);

        if (!transactionSnap.exists()) {
            throw new Error("Transaction not found.");
        }
        const oldData = transactionSnap.data() as Transaction;
        
        // All reads are now complete. Start writes.
        transaction.update(transactionRef, transactionData);

        // Handle balance adjustments if amount or accounts change
        const amountChanged = transactionData.amount !== undefined && transactionData.amount !== oldData.amount;
        const accountChanged = transactionData.accountId !== undefined && transactionData.accountId !== oldData.accountId;

        if (oldData.type === 'expense' && (amountChanged || accountChanged)) {
            // Revert old transaction
            if (oldData.accountId) {
                await adjustAccountBalance(transaction, oldData.accountId, oldData.amount, 'add');
            }
            // Apply new transaction
            const newAccountId = transactionData.accountId || oldData.accountId;
            const newAmount = transactionData.amount || oldData.amount;
             if (newAccountId) {
                await adjustAccountBalance(transaction, newAccountId, newAmount, 'subtract');
            }
        }
    });
}

export async function deleteTransaction(id: string): Promise<void> {
   await runTransaction(db, async (transaction) => {
        const transactionRef = doc(db, TRANSACTIONS_COLLECTION, id);
        const transactionSnap = await transaction.get(transactionRef);

        if (!transactionSnap.exists()) {
            throw new Error("Transaction not found.");
        }
        const oldData = transactionSnap.data() as Transaction;

        transaction.delete(transactionRef);

        if (oldData.type === 'expense' && oldData.accountId) {
            await adjustAccountBalance(transaction, oldData.accountId, oldData.amount, 'add');
        } else if (oldData.type === 'transfer' && oldData.transferFromId && oldData.transferToId) {
            await adjustAccountBalance(transaction, oldData.transferFromId, oldData.amount, 'add');
            await adjustAccountBalance(transaction, oldData.transferToId, oldData.amount, 'subtract');
        }
    });
}
