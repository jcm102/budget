
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

const updateBudgetSpent = async (transaction: FirebaseFirestore.Transaction, month: string, splits: TransactionSplit[], operation: 'add' | 'subtract') => {
    if (!splits || splits.length === 0) return;

    for (const split of splits) {
        const q = query(
            collection(db, BUDGET_ITEMS_COLLECTION),
            where('month', '==', month),
            where('categoryId', '==', split.categoryId)
        );
        const budgetSnapshot = await getDocs(q); // Must use getDocs inside transaction

        if (!budgetSnapshot.empty) {
            const budgetDoc = budgetSnapshot.docs[0];
            const budgetItem = budgetDoc.data() as MonthlyBudgetItem;
            const breakdown = budgetItem.breakdown || [];
            
            const updatedBreakdown = breakdown.map(item => {
                if (item.name === split.budgetItemName) {
                    const currentActual = (item as any).actual || 0;
                    const newActual = operation === 'add'
                        ? currentActual + split.amount
                        : currentActual - split.amount;
                    return { ...item, actual: newActual };
                }
                return item;
            });
            transaction.update(budgetDoc.ref, { breakdown: updatedBreakdown });
        }
    }
};

export async function addTransaction(transactionData: Omit<Transaction, 'id'>): Promise<Transaction> {
  const month = new Date(transactionData.date).toISOString().slice(0, 7);

  const docRef = await runTransaction(db, async (transaction) => {
    if (transactionData.type === 'expense' && transactionData.splits) {
        await updateBudgetSpent(transaction, month, transactionData.splits, 'add');
    }
    const newDocRef = doc(collection(db, TRANSACTIONS_COLLECTION));
    transaction.set(newDocRef, transactionData);
    return newDocRef;
  });

  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<Transaction, 'id'>) };
}

export async function updateTransaction(id: string, transactionData: Partial<Omit<Transaction, 'id'>>): Promise<void> {
    const transactionRef = doc(db, TRANSACTIONS_COLLECTION, id);
    const month = new Date(transactionData.date!).toISOString().slice(0, 7);

    await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(transactionRef);
        if (!docSnap.exists()) {
            throw new Error("Transaction not found");
        }
        const oldData = docSnap.data() as Transaction;

        // Revert old transaction's impact
        if (oldData.type === 'expense' && oldData.splits) {
            await updateBudgetSpent(transaction, month, oldData.splits, 'subtract');
        }

        // Apply new transaction's impact
        if (transactionData.type === 'expense' && transactionData.splits) {
            await updateBudgetSpent(transaction, month, transactionData.splits, 'add');
        }

        transaction.update(transactionRef, transactionData);
    });
}

export async function deleteTransaction(id: string): Promise<void> {
  const transactionRef = doc(db, TRANSACTIONS_COLLECTION, id);
  
  await runTransaction(db, async (transaction) => {
    const docSnap = await transaction.get(transactionRef);
    if (!docSnap.exists()) {
      throw new Error("Transaction not found");
    }
    const data = docSnap.data() as Transaction;
    const month = new Date(data.date).toISOString().slice(0, 7);

    if (data.type === 'expense' && data.splits) {
        await updateBudgetSpent(transaction, month, data.splits, 'subtract');
    }
    
    transaction.delete(transactionRef);
  });
}
