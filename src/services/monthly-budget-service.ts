

'use server';

import { db } from '@/lib/firebase';
import type { MonthlyBudgetItem, Transaction, TransactionSplit, BudgetItem, AccountDetails } from '@/types';
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

// ===== Transactions & Accounts =====

export async function getAccountDetails(accountId: string): Promise<AccountDetails | null> {
    const accountRef = doc(db, ACCOUNTS_COLLECTION, accountId);
    const docSnap = await getDoc(accountRef);
    if (!docSnap.exists()) {
        return null;
    }
    return { id: docSnap.id, ...docSnap.data() } as AccountDetails;
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

export async function getTransactionsForAccount(accountId: string): Promise<Transaction[]> {
    const expenseQuery = query(
        collection(db, TRANSACTIONS_COLLECTION),
        where('sourceAccountId', '==', accountId)
    );

    // We also need to find transfers *to* this account
    const transferToQuery = query(
        collection(db, TRANSACTIONS_COLLECTION),
        where('splits', 'array-contains', { type: 'transfer', destinationAccountId: accountId })
    );

    const [expenseSnap, toSnap] = await Promise.all([
        getDocs(expenseQuery),
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
    processSnapshot(toSnap);
    
    const allTransactions = Array.from(transactionsMap.values());
    
    // Final filter to ensure we only include relevant transactions
    const relevantTransactions = allTransactions.filter(tx => 
        tx.sourceAccountId === accountId || tx.splits.some(s => s.type === 'transfer' && s.destinationAccountId === accountId)
    );

    return relevantTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}


export async function addTransaction(transactionData: Omit<Transaction, 'id'>): Promise<Transaction> {
    const newDocRef = await runTransaction(db, async (transaction) => {
        const { sourceAccountId, amount, splits } = transactionData;

        // --- ALL READS FIRST ---
        const newTransactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));

        const sourceAccountRef = doc(db, ACCOUNTS_COLLECTION, sourceAccountId);
        const sourceAccountSnap = await transaction.get(sourceAccountRef);
        if (!sourceAccountSnap.exists()) throw new Error(`Source account with ID ${sourceAccountId} not found.`);

        const transferDestinationRefs = splits
            .filter(s => s.type === 'transfer' && s.destinationAccountId)
            .map(s => doc(db, ACCOUNTS_COLLECTION, s.destinationAccountId!));
        
        const transferDestinationSnaps = await Promise.all(transferDestinationRefs.map(ref => transaction.get(ref)));

        for(const snap of transferDestinationSnaps) {
            if (!snap.exists()) throw new Error(`One of the destination accounts was not found.`);
        }

        // --- ALL WRITES AFTER READS ---
        transaction.set(newTransactionRef, transactionData);

        // Debit source account
        const sourceBalance = sourceAccountSnap.data()?.balance || 0;
        transaction.update(sourceAccountRef, { balance: sourceBalance - amount });

        // Credit destination accounts for transfers
        splits.forEach((split, index) => {
            if (split.type === 'transfer') {
                const destSnap = transferDestinationSnaps[index];
                const destBalance = destSnap.data()?.balance || 0;
                transaction.update(destSnap.ref, { balance: destBalance + split.amount });
            }
        });
        
        return newTransactionRef;
    });

    // Post-transaction: Mark PA payments as complete. This is not atomic with the transaction, but it's safer.
     if (transactionData.splits) {
        const categoryIds = transactionData.splits.filter(s => s.type === 'expense').map(s => s.categoryId);
        if (categoryIds.length > 0) {
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
    }


    const docSnap = await getDoc(newDocRef);
    return { id: docSnap.id, ...(docSnap.data() as Omit<Transaction, 'id'>) };
}

async function revertTransaction(transaction: FirebaseFirestore.Transaction, oldData: Transaction) {
    // Revert source account debit
    const sourceRef = doc(db, ACCOUNTS_COLLECTION, oldData.sourceAccountId);
    const sourceSnap = await transaction.get(sourceRef);
    const sourceBalance = sourceSnap.data()?.balance || 0;
    transaction.update(sourceRef, { balance: sourceBalance + oldData.amount });

    // Revert transfer credits
    for (const split of oldData.splits) {
        if (split.type === 'transfer' && split.destinationAccountId) {
            const destRef = doc(db, ACCOUNTS_COLLECTION, split.destinationAccountId);
            const destSnap = await transaction.get(destRef);
            const destBalance = destSnap.data()?.balance || 0;
            transaction.update(destRef, { balance: destBalance - split.amount });
        }
    }
}

async function applyTransaction(transaction: FirebaseFirestore.Transaction, newData: Transaction) {
    // Apply source account debit
    const sourceRef = doc(db, ACCOUNTS_COLLECTION, newData.sourceAccountId);
    const sourceSnap = await transaction.get(sourceRef);
    const sourceBalance = sourceSnap.data()?.balance || 0;
    transaction.update(sourceRef, { balance: sourceBalance - newData.amount });

    // Apply transfer credits
    for (const split of newData.splits) {
        if (split.type === 'transfer' && split.destinationAccountId) {
            const destRef = doc(db, ACCOUNTS_COLLECTION, split.destinationAccountId);
            const destSnap = await transaction.get(destRef);
            const destBalance = destSnap.data()?.balance || 0;
            transaction.update(destRef, { balance: destBalance + split.amount });
        }
    }
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
        const newData = { ...oldData, ...transactionData, id };
        
        // --- ALL WRITES AFTER READS ---
        await revertTransaction(transaction, oldData);
        await applyTransaction(transaction, newData);
        
        transaction.update(transactionRef, transactionData);
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

        await revertTransaction(transaction, oldData);
        transaction.delete(transactionRef);
    });
}
