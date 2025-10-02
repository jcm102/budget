

'use server';

import { db } from '@/lib/firebase';
import type { MonthlyBudgetItem, Transaction, TransactionSplit, BudgetItem, AccountDetails, Debt, BudgetSubItem } from '@/types';
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
  writeBatch,
  limit
} from 'firebase/firestore';
import { getBudgetItems, cycleBudgetItems as cycleOverviewItems } from './budget-service';
import { format, addMonths } from 'date-fns';
import { createAutomatedBackup } from './backup-service';

const BUDGET_ITEMS_COLLECTION = 'monthly-budget-items';
const TRANSACTIONS_COLLECTION = 'transactions';
const ACCOUNTS_COLLECTION = 'transferees';
const PA_PAYMENTS_COLLECTION = 'budget-items';
const DEBT_COLLECTION = 'debts';


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

export async function updateBudgetItem(id: string, itemData: { budgeted: number, breakdown?: BudgetSubItem[] | null }): Promise<void> {
  const itemRef = doc(db, BUDGET_ITEMS_COLLECTION, id);
  // The hook now calculates the total, so we just need to save it.
  await updateDoc(itemRef, itemData);
}

export async function cycleToNextMonth(): Promise<void> {
  await createAutomatedBackup('pre-monthly-budget-cycle');
  const today = new Date();
  const currentMonth = format(today, 'yyyy-MM');
  const nextMonth = format(addMonths(today, 1), 'yyyy-MM');

  await runTransaction(db, async (transaction) => {
    // 1. Get all documents for the next month
    const nextMonthQuery = query(collection(db, BUDGET_ITEMS_COLLECTION), where('month', '==', nextMonth));
    const nextMonthSnapshot = await getDocs(nextMonthQuery);

    // 2. Get all documents for the current month
    const currentMonthQuery = query(collection(db, BUDGET_ITEMS_COLLECTION), where('month', '==', currentMonth));
    const currentMonthSnapshot = await getDocs(currentMonthQuery);

    // 3. Delete all documents for the current month
    currentMonthSnapshot.forEach(doc => {
      transaction.delete(doc.ref);
    });

    // 4. Move next month's documents to the current month by updating their 'month' field
    nextMonthSnapshot.forEach(doc => {
      transaction.update(doc.ref, { month: currentMonth });
    });
  });

  // After successfully cycling the main budget, also cycle the overview items.
  await cycleOverviewItems();
}


// ===== Transactions & Accounts =====

export async function getAccountDetails(accountId: string): Promise<AccountDetails | null> {
    const accountRef = doc(db, ACCOUNTS_COLLECTION, accountId);
    const docSnap = await getDoc(accountRef);
    if (!docSnap.exists()) {
        return null;
    }
    const accountData = { id: docSnap.id, ...docSnap.data() } as AccountDetails;

    // If it's a credit account with a linked debt, fetch the debt balance.
    if (accountData.type === 'Credit' && accountData.linkedDebtId) {
        const debtRef = doc(db, DEBT_COLLECTION, accountData.linkedDebtId);
        const debtSnap = await getDoc(debtRef);
        if (debtSnap.exists()) {
            const debtData = debtSnap.data() as Debt;
            accountData.balance = debtData.balance;
        }
    }

    return accountData;
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

export async function getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]> {
  const q = query(
    collection(db, TRANSACTIONS_COLLECTION),
    where('date', '>=', startDate.toISOString()),
    where('date', '<=', endDate.toISOString()),
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

    return relevantTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}


export async function addTransaction(transactionData: Omit<Transaction, 'id'>): Promise<Transaction> {
    const newDocRef = await runTransaction(db, async (transaction) => {
        const { sourceAccountId, amount, splits } = transactionData;

        // --- Start READS ---
        const sourceAccountRef = doc(db, ACCOUNTS_COLLECTION, sourceAccountId);
        const sourceAccountSnap = await transaction.get(sourceAccountRef);
        if (!sourceAccountSnap.exists()) throw new Error(`Source account with ID ${sourceAccountId} not found.`);
        
        const sourceAccountData = sourceAccountSnap.data() as AccountDetails;

        const destinationAccountIds = splits
            .filter(s => s.type === 'transfer' && s.destinationAccountId)
            .map(s => s.destinationAccountId!);
            
        const uniqueDestinationIds = [...new Set(destinationAccountIds)];
        const destinationAccountRefs = uniqueDestinationIds.map(id => doc(db, ACCOUNTS_COLLECTION, id));
        
        let destinationAccountSnaps: FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>[] = [];
        if (destinationAccountRefs.length > 0) {
            destinationAccountSnaps = await Promise.all(destinationAccountRefs.map(ref => transaction.get(ref)));
        }

        for(const snap of destinationAccountSnaps) {
            if (!snap.exists()) throw new Error(`One of the destination accounts was not found.`);
        }
        
        let linkedDebtRef;
        let linkedDebtSnap;
        if (sourceAccountData.type === 'Credit' && sourceAccountData.linkedDebtId) {
            linkedDebtRef = doc(db, DEBT_COLLECTION, sourceAccountData.linkedDebtId);
            linkedDebtSnap = await transaction.get(linkedDebtRef);
             if (!linkedDebtSnap.exists()) throw new Error(`Linked debt with ID ${sourceAccountData.linkedDebtId} not found.`);
        }

        // --- End READS ---

        // --- Start WRITES ---
        const newTransactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
        transaction.set(newTransactionRef, transactionData);

        // Debit/Credit source account
        if (sourceAccountData.type === 'Credit' && linkedDebtRef && linkedDebtSnap) {
            const debtBalance = (linkedDebtSnap.data() as Debt).balance || 0;
            transaction.update(linkedDebtRef, { balance: debtBalance + amount });
        } else {
            const sourceBalance = sourceAccountData.balance || 0;
            transaction.update(sourceAccountRef, { balance: sourceBalance - amount });
        }

        // Credit/Debit destination accounts for transfers
        splits.forEach((split) => {
            if (split.type === 'transfer') {
                const destSnap = destinationAccountSnaps.find(snap => snap.id === split.destinationAccountId);
                if (destSnap) {
                     const destData = destSnap.data() as AccountDetails;
                     const destBalance = destData.balance || 0;
                     if (destData.type === 'IOU' || destData.type === 'Credit') {
                         transaction.update(destSnap.ref, { balance: destBalance - split.amount });
                     } else { 
                         transaction.update(destSnap.ref, { balance: destBalance + split.amount });
                     }
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

async function revertTransaction(transaction: FirebaseFirestore.Transaction, oldData: Transaction, accountSnaps: Map<string, FirebaseFirestore.DocumentSnapshot>, debtSnaps: Map<string, FirebaseFirestore.DocumentSnapshot>) {
    const sourceSnap = accountSnaps.get(oldData.sourceAccountId);
    if (sourceSnap?.exists()) {
        const sourceData = sourceSnap.data() as AccountDetails;
        if (sourceData.type === 'Credit' && sourceData.linkedDebtId) {
            const debtSnap = debtSnaps.get(sourceData.linkedDebtId);
            if (debtSnap?.exists()) {
                const debtBalance = (debtSnap.data() as Debt).balance || 0;
                transaction.update(debtSnap.ref, { balance: debtBalance - oldData.amount });
            }
        } else {
            const sourceBalance = sourceData.balance || 0;
            transaction.update(sourceSnap.ref, { balance: sourceBalance + oldData.amount });
        }
    }

    for (const split of (oldData.splits || [])) {
        if (split.type === 'transfer' && split.destinationAccountId) {
            const destSnap = accountSnaps.get(split.destinationAccountId);
            if(destSnap?.exists()) {
                const destData = destSnap.data() as AccountDetails;
                const destBalance = destData.balance || 0;
                 if (destData.type === 'IOU' || destData.type === 'Credit') {
                    transaction.update(destSnap.ref, { balance: destBalance + split.amount });
                 } else {
                    transaction.update(destSnap.ref, { balance: destBalance - split.amount });
                 }
            }
        }
    }
}

async function applyTransaction(transaction: FirebaseFirestore.Transaction, newData: Transaction, accountSnaps: Map<string, FirebaseFirestore.DocumentSnapshot>, debtSnaps: Map<string, FirebaseFirestore.DocumentSnapshot>) {
    const sourceSnap = accountSnaps.get(newData.sourceAccountId);
    if (!sourceSnap?.exists()) {
        throw new Error(`Source account with ID ${newData.sourceAccountId} not found.`);
    }
    const sourceData = sourceSnap.data() as AccountDetails;

    if (sourceData.type === 'Credit' && sourceData.linkedDebtId) {
        const debtSnap = debtSnaps.get(sourceData.linkedDebtId);
        if (!debtSnap?.exists()) {
             throw new Error(`Linked debt with ID ${sourceData.linkedDebtId} not found.`);
        }
        const debtBalance = (debtSnap.data() as Debt).balance || 0;
        transaction.update(debtSnap.ref, { balance: debtBalance + newData.amount });
    } else {
        const sourceBalance = sourceData.balance || 0;
        transaction.update(sourceSnap.ref, { balance: sourceBalance - newData.amount });
    }

    for (const split of (newData.splits || [])) {
        if (split.type === 'transfer' && split.destinationAccountId) {
            const destSnap = accountSnaps.get(split.destinationAccountId);
            if (!destSnap?.exists()) {
                 throw new Error(`Destination account with ID ${split.destinationAccountId} not found.`);
            }
            const destData = destSnap.data() as AccountDetails;
            const destBalance = destData.balance || 0;
            if (destData.type === 'IOU' || destData.type === 'Credit') {
                transaction.update(destSnap.ref, { balance: destBalance - split.amount });
            } else {
                transaction.update(destSnap.ref, { balance: destBalance + split.amount });
            }
        }
    }
}


export async function updateTransaction(id: string, transactionData: Partial<Omit<Transaction, 'id'>>): Promise<void> {
    await runTransaction(db, async (transaction) => {
        // --- Start READS ---
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
        
        const accountIds = new Set<string>();
        accountIds.add(oldData.sourceAccountId);
        accountIds.add(newData.sourceAccountId);
        [...(oldData.splits || []), ...(newData.splits || [])].forEach(s => {
            if (s.type === 'transfer' && s.destinationAccountId) {
                accountIds.add(s.destinationAccountId);
            }
        });

        const accountRefs = Array.from(accountIds).map(accId => doc(db, ACCOUNTS_COLLECTION, accId));
        const accountSnaps = await Promise.all(accountRefs.map(ref => transaction.get(ref)));
        const accountSnapsMap = new Map(accountSnaps.map(snap => [snap.id, snap]));

        const debtIds = new Set<string>();
        accountSnaps.forEach(snap => {
            if (snap.exists()) {
                const accData = snap.data() as AccountDetails;
                if (accData.type === 'Credit' && accData.linkedDebtId) {
                    debtIds.add(accData.linkedDebtId);
                }
            }
        });
        const debtRefs = Array.from(debtIds).map(debtId => doc(db, DEBT_COLLECTION, debtId));
        const debtSnaps = await Promise.all(debtRefs.map(ref => transaction.get(ref)));
        const debtSnapsMap = new Map(debtSnaps.map(snap => [snap.id, snap]));
        // --- End READS ---


        // --- Start WRITES ---
        await revertTransaction(transaction, oldData, accountSnapsMap, debtSnapsMap);
        await applyTransaction(transaction, newData, accountSnapsMap, debtSnapsMap);
        
        transaction.update(transactionRef, transactionData);
    });
}

export async function deleteTransaction(id: string): Promise<void> {
   await runTransaction(db, async (transaction) => {
        // --- Start READS ---
        const transactionRef = doc(db, TRANSACTIONS_COLLECTION, id);
        const transactionSnap = await transaction.get(transactionRef);
        if (!transactionSnap.exists()) {
            console.warn(`Transaction with id ${id} not found for deletion.`);
            return;
        }
        const oldData = { id, ...transactionSnap.data() } as Transaction;
        
        const accountIds = new Set<string>();
        accountIds.add(oldData.sourceAccountId);
        (oldData.splits || []).forEach(s => {
            if (s.type === 'transfer' && s.destinationAccountId) {
                accountIds.add(s.destinationAccountId);
            }
        });

        const accountRefs = Array.from(accountIds).map(accId => doc(db, ACCOUNTS_COLLECTION, accId));
        const accountSnaps = await Promise.all(accountRefs.map(ref => transaction.get(ref)));
        const accountSnapsMap = new Map(accountSnaps.map(snap => [snap.id, snap]));
        
        const debtIds = new Set<string>();
        accountSnaps.forEach(snap => {
            if (snap.exists()) {
                const accData = snap.data() as AccountDetails;
                if (accData.type === 'Credit' && accData.linkedDebtId) {
                    debtIds.add(accData.linkedDebtId);
                }
            }
        });
        const debtRefs = Array.from(debtIds).map(debtId => doc(db, DEBT_COLLECTION, debtId));
        const debtSnaps = await Promise.all(debtRefs.map(ref => transaction.get(ref)));
        const debtSnapsMap = new Map(debtSnaps.map(snap => [snap.id, snap]));
        // --- End READS ---
        
        // --- Start WRITES ---
        await revertTransaction(transaction, oldData, accountSnapsMap, debtSnapsMap);
        transaction.delete(transactionRef);
    });
}


    

  
