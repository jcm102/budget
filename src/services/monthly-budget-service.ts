

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
  deleteDoc,
  writeBatch
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
    // This query is difficult because Firestore cannot query for a specific element in an array of objects.
    // A better approach is to fetch all transactions for the month and filter client-side, 
    // but for now we will fetch all and filter here.
    const allTransactionsSnapshot = await getDocs(collection(db, TRANSACTIONS_COLLECTION));

    const transactionsMap = new Map<string, Transaction>();
    
    allTransactionsSnapshot.docs.forEach(doc => {
        const tx = { id: doc.id, ...doc.data() } as Transaction;
        const isSource = tx.sourceAccountId === accountId;
        const isDestination = (tx.splits || []).some(s => s.type === 'transfer' && s.destinationAccountId === accountId);
        
        if (isSource || isDestination) {
            if (!transactionsMap.has(doc.id)) {
                transactionsMap.set(doc.id, tx);
            }
        }
    });

    const relevantTransactions = Array.from(transactionsMap.values());

    return relevantTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(b.date).getTime());
}


export async function addTransaction(transactionData: Omit<Transaction, 'id'>): Promise<Transaction> {
    const newDocRef = await runTransaction(db, async (transaction) => {
        const { sourceAccountId, amount, splits } = transactionData;

        const newTransactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));

        // --- Start READS ---
        const sourceAccountRef = doc(db, ACCOUNTS_COLLECTION, sourceAccountId);
        const sourceAccountSnap = await transaction.get(sourceAccountRef);
        if (!sourceAccountSnap.exists()) throw new Error(`Source account with ID ${sourceAccountId} not found.`);

        const transferDestinationRefs = splits
            .filter(s => s.type === 'transfer' && s.destinationAccountId)
            .map(s => doc(db, ACCOUNTS_COLLECTION, s.destinationAccountId!));
        
        let transferDestinationSnaps: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>[] = [];
        if (transferDestinationRefs.length > 0) {
            transferDestinationSnaps = await Promise.all(transferDestinationRefs.map(ref => transaction.get(ref)));
        }

        for(const snap of transferDestinationSnaps) {
            if (!snap.exists()) throw new Error(`One of the destination accounts was not found.`);
        }
        // --- End READS ---

        // --- Start WRITES ---
        transaction.set(newTransactionRef, transactionData);

        // Debit source account
        const sourceBalance = sourceAccountSnap.data()?.balance || 0;
        transaction.update(sourceAccountRef, { balance: sourceBalance - amount });

        // Credit destination accounts for transfers
        splits.forEach((split, index) => {
            if (split.type === 'transfer') {
                const destSnap = transferDestinationSnaps.find(snap => snap.id === split.destinationAccountId);
                if (destSnap) {
                     const destBalance = destSnap.data()?.balance || 0;
                     transaction.update(destSnap.ref, { balance: destBalance + split.amount });
                }
            }
        });
        // --- End WRITES ---
        
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
    const sourceRef = doc(db, ACCOUNTS_COLLECTION, oldData.sourceAccountId);
    const sourceSnap = await transaction.get(sourceRef);
    if (sourceSnap.exists()) {
        const sourceBalance = sourceSnap.data()?.balance || 0;
        transaction.update(sourceRef, { balance: sourceBalance + oldData.amount });
    }

    for (const split of (oldData.splits || [])) {
        if (split.type === 'transfer' && split.destinationAccountId) {
            const destRef = doc(db, ACCOUNTS_COLLECTION, split.destinationAccountId);
            const destSnap = await transaction.get(destRef);
            if(destSnap.exists()) {
                const destBalance = destSnap.data()?.balance || 0;
                transaction.update(destRef, { balance: destBalance - split.amount });
            }
        }
    }
}

async function applyTransaction(transaction: FirebaseFirestore.Transaction, newData: Transaction) {
    const sourceRef = doc(db, ACCOUNTS_COLLECTION, newData.sourceAccountId);
    const sourceSnap = await transaction.get(sourceRef);
    if (!sourceSnap.exists()) {
        throw new Error(`Source account with ID ${newData.sourceAccountId} not found.`);
    }
    const sourceBalance = sourceSnap.data()?.balance || 0;
    transaction.update(sourceRef, { balance: sourceBalance - newData.amount });

    for (const split of (newData.splits || [])) {
        if (split.type === 'transfer' && split.destinationAccountId) {
            const destRef = doc(db, ACCOUNTS_COLLECTION, split.destinationAccountId);
            const destSnap = await transaction.get(destRef);
            if (!destSnap.exists()) {
                 throw new Error(`Destination account with ID ${split.destinationAccountId} not found.`);
            }
            const destBalance = destSnap.data()?.balance || 0;
            transaction.update(destRef, { balance: destBalance + split.amount });
        }
    }
}


export async function updateTransaction(id: string, transactionData: Partial<Omit<Transaction, 'id'>>): Promise<void> {
    await runTransaction(db, async (transaction) => {
        const transactionRef = doc(db, TRANSACTIONS_COLLECTION, id);
        const transactionSnap = await transaction.get(transactionRef);
        if (!transactionSnap.exists()) {
            throw new Error("Transaction not found.");
        }
        const oldData = { id, ...transactionSnap.data() } as Transaction;
        
        const newData: Transaction = {
            id: id,
            description: transactionData.description ?? oldData.description,
            amount: transactionData.amount ?? oldData.amount,
            date: transactionData.date ?? oldData.date,
            sourceAccountId: transactionData.sourceAccountId ?? oldData.sourceAccountId,
            splits: transactionData.splits ?? oldData.splits,
        };

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
            console.warn(`Transaction with id ${id} not found for deletion.`);
            return;
        }
        const oldData = transactionSnap.data() as Transaction;

        const sourceRef = doc(db, ACCOUNTS_COLLECTION, oldData.sourceAccountId);
        const sourceSnap = await transaction.get(sourceRef);
        if (sourceSnap.exists()) {
            const sourceBalance = sourceSnap.data()?.balance || 0;
            transaction.update(sourceRef, { balance: sourceBalance + oldData.amount });
        }

        for (const split of (oldData.splits || [])) {
            if (split.type === 'transfer' && split.destinationAccountId) {
                const destRef = doc(db, ACCOUNTS_COLLECTION, split.destinationAccountId);
                const destSnap = await transaction.get(destRef);
                if (destSnap.exists()) {
                    const destBalance = destSnap.data()?.balance || 0;
                    transaction.update(destRef, { balance: destBalance - split.amount });
                }
            }
        }
        
        transaction.delete(transactionRef);
    });
}
