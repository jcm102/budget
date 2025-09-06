

'use server';

import { db } from '@/lib/firebase';
import type { MonthlyBudgetItem, Transaction, TransactionSplit, BudgetItem } from '@/types';
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
import { getBudgetItems } from './budget-service';

const BUDGET_ITEMS_COLLECTION = 'monthly-budget-items';
const TRANSACTIONS_COLLECTION = 'transactions';
const ACCOUNTS_COLLECTION = 'transferees';
const PA_PAYMENTS_COLLECTION = 'budget-items';

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

export async function getTransactionsForAccount(accountId: string): Promise<Transaction[]> {
    const expenseQuery = query(
        collection(db, TRANSACTIONS_COLLECTION),
        where('accountId', '==', accountId)
    );
    const transferFromQuery = query(
        collection(db, TRANSACTIONS_COLLECTION),
        where('transferFromId', '==', accountId)
    );
    const transferToQuery = query(
        collection(db, TRANSACTIONS_COLLECTION),
        where('transferToId', '==', accountId)
    );

    const [expenseSnap, fromSnap, toSnap] = await Promise.all([
        getDocs(expenseQuery),
        getDocs(transferFromQuery),
        getDocs(transferToQuery),
    ]);

    const transactionsMap = new Map<string, Transaction>();
    
    const processSnapshot = (snapshot: FirebaseFirestore.QuerySnapshot) => {
        snapshot.docs.forEach(doc => {
            if (!transactionsMap.has(doc.id)) {
                transactionsMap.set(doc.id, { id: doc.id, ...doc.data() } as Transaction);
            }
        });
    }

    processSnapshot(expenseSnap);
    processSnapshot(fromSnap);
    processSnapshot(toSnap);

    const allTransactions = Array.from(transactionsMap.values());

    return allTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}


export async function addTransaction(transactionData: Omit<Transaction, 'id'>): Promise<Transaction> {
    const newDocRef = await runTransaction(db, async (transaction) => {
        const { type, accountId, transferFromId, transferToId, amount, splits } = transactionData;

        // --- ALL READS FIRST ---
        const newTransactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));

        let fromAccountRef, toAccountRef, fromAccountSnap, toAccountSnap;
        if (type === 'expense' && accountId) {
            fromAccountRef = doc(db, ACCOUNTS_COLLECTION, accountId);
            fromAccountSnap = await transaction.get(fromAccountRef);
            if (!fromAccountSnap.exists()) throw new Error(`Account with ID ${accountId} not found.`);
        } else if (type === 'transfer' && transferFromId && transferToId) {
            fromAccountRef = doc(db, ACCOUNTS_COLLECTION, transferFromId);
            toAccountRef = doc(db, ACCOUNTS_COLLECTION, transferToId);
            fromAccountSnap = await transaction.get(fromAccountRef);
            toAccountSnap = await transaction.get(toAccountRef);
            if (!fromAccountSnap.exists()) throw new Error(`Account with ID ${transferFromId} not found.`);
            if (!toAccountSnap.exists()) throw new Error(`Account with ID ${transferToId} not found.`);
        }

        // --- ALL WRITES AFTER READS ---
        transaction.set(newTransactionRef, transactionData);

        if (type === 'expense' && fromAccountRef && fromAccountSnap) {
            const currentBalance = fromAccountSnap.data()?.balance || 0;
            transaction.update(fromAccountRef, { balance: currentBalance - amount });
        } else if (type === 'transfer' && fromAccountRef && toAccountRef && fromAccountSnap && toAccountSnap) {
            const fromBalance = fromAccountSnap.data()?.balance || 0;
            const toBalance = toAccountSnap.data()?.balance || 0;
            transaction.update(fromAccountRef, { balance: fromBalance - amount });
            transaction.update(toAccountRef, { balance: toBalance + amount });
        }
        
        return newTransactionRef;
    });

    // Post-transaction: Mark PA payments as complete. This is not atomic with the transaction, but it's safer.
     if (transactionData.type === 'expense' && transactionData.splits) {
        const categoryIds = transactionData.splits.map(s => s.categoryId);
        const paPaymentsQuery = query(
            collection(db, PA_PAYMENTS_COLLECTION),
            where('type', '==', 'Pre-Authorized Payments'),
            where('budgetCategoryId', 'in', categoryIds),
            where('completed', '==', false)
        );
        const paPaymentsSnapshot = await getDocs(paPaymentsQuery);
        const batch = writeBatch(db);
        paPaymentsSnapshot.forEach(doc => {
            batch.update(doc.ref, { completed: true });
        });
        await batch.commit();
    }


    const docSnap = await getDoc(newDocRef);
    return { id: docSnap.id, ...(docSnap.data() as Omit<Transaction, 'id'>) };
}

export async function updateTransaction(id: string, transactionData: Partial<Omit<Transaction, 'id'>>): Promise<void> {
    await runTransaction(db, async (transaction) => {
        // --- ALL READS FIRST ---
        const transactionRef = doc(db, TRANSACTIONS_COLLECTION, id);
        const transactionSnap = await transaction.get(transactionRef);
        if (!transactionSnap.exists()) {
            throw new Error("Transaction not found.");
        }
        const oldData = transactionSnap.data() as Transaction;
        
        // --- ALL WRITES AFTER READS ---
        // Revert old transaction balances first
        if (oldData.type === 'expense' && oldData.accountId) {
             const oldAccountRef = doc(db, ACCOUNTS_COLLECTION, oldData.accountId);
             const oldAccountSnap = await transaction.get(oldAccountRef);
             const oldBalance = oldAccountSnap.data()?.balance || 0;
             transaction.update(oldAccountRef, {balance: oldBalance + oldData.amount});
        }
        
        // Apply new transaction balances
        const newData = { ...oldData, ...transactionData };
        if(newData.type === 'expense' && newData.accountId) {
             const newAccountRef = doc(db, ACCOUNTS_COLLECTION, newData.accountId);
             const newAccountSnap = await transaction.get(newAccountRef);
             const newBalance = newAccountSnap.data()?.balance || 0;
             transaction.update(newAccountRef, {balance: newBalance - newData.amount});
        }
        
        // Update the transaction document
        transaction.update(transactionRef, transactionData);
    });
}

export async function deleteTransaction(id: string): Promise<void> {
   await runTransaction(db, async (transaction) => {
        // --- ALL READS FIRST ---
        const transactionRef = doc(db, TRANSACTIONS_COLLECTION, id);
        const transactionSnap = await transaction.get(transactionRef);
        if (!transactionSnap.exists()) {
            throw new Error("Transaction not found.");
        }
        const oldData = transactionSnap.data() as Transaction;

        let fromAccountRef, toAccountRef, fromAccountSnap, toAccountSnap;
        if (oldData.type === 'expense' && oldData.accountId) {
            fromAccountRef = doc(db, ACCOUNTS_COLLECTION, oldData.accountId);
            fromAccountSnap = await transaction.get(fromAccountRef);
        } else if (oldData.type === 'transfer' && oldData.transferFromId && oldData.transferToId) {
            fromAccountRef = doc(db, ACCOUNTS_COLLECTION, oldData.transferFromId);
            toAccountRef = doc(db, ACCOUNTS_COLLECTION, oldData.transferToId);
            fromAccountSnap = await transaction.get(fromAccountRef);
            toAccountSnap = await transaction.get(toAccountRef);
        }

        // --- ALL WRITES AFTER READS ---
        transaction.delete(transactionRef);

        if (oldData.type === 'expense' && fromAccountRef && fromAccountSnap) {
            const currentBalance = fromAccountSnap.data()?.balance || 0;
            transaction.update(fromAccountRef, { balance: currentBalance + oldData.amount });
        } else if (oldData.type === 'transfer' && fromAccountRef && toAccountRef && fromAccountSnap && toAccountSnap) {
            const fromBalance = fromAccountSnap.data()?.balance || 0;
            const toBalance = toAccountSnap.data()?.balance || 0;
            transaction.update(fromAccountRef, { balance: fromBalance + oldData.amount });
            transaction.update(toAccountRef, { balance: toBalance - oldData.amount });
        }
    });
}
