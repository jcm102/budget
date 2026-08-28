
import { Firestore, collection, getDocs, doc, updateDoc, addDoc, getDoc, query, where, orderBy, runTransaction, deleteDoc, writeBatch, limit, DocumentSnapshot, Transaction as FirestoreTransaction } from 'firebase/firestore';
import type { MonthlyBudgetItem, Transaction, TransactionSplit, BudgetItem, AccountDetails, Debt, BudgetSubItem } from '@/types';
import { format, addMonths } from 'date-fns';
import { createAutomatedBackup } from '@/services/backup-service';
import { cycleBudgetItems as cycleOverviewItems } from '@/app/budget/services/budget-service';
import { syncSinkingFundsBudget, syncWealthsimpleTransfer } from '@/services/savings-service';
import { syncDebtPaymentsToMonthlyBudget } from '@/app/debt/services/debt-service';

const BUDGET_ITEMS_COLLECTION = 'monthly-budget-items';
const TRANSACTIONS_COLLECTION = 'transactions';
const ACCOUNTS_COLLECTION = 'transferees';
const PA_PAYMENTS_COLLECTION = 'budget-items';
const DEBT_COLLECTION = 'debts';
const SINKING_FUNDS_CATEGORY_ID = 'KbWSJVpQRZBOTmu8HxjI';


// ===== Budget Items =====

export async function getBudgetForMonth(db: Firestore, month: string): Promise<MonthlyBudgetItem[]> {
  const q = query(collection(db, BUDGET_ITEMS_COLLECTION), where('month', '==', month));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MonthlyBudgetItem));
}

export async function addBudgetItem(db: Firestore, itemData: Omit<MonthlyBudgetItem, 'id'>): Promise<MonthlyBudgetItem> {
  const docRef = await addDoc(collection(db, BUDGET_ITEMS_COLLECTION), itemData);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<MonthlyBudgetItem, 'id'>) };
}

export async function updateBudgetItem(db: Firestore, id: string, itemData: { budgeted: number, breakdown?: BudgetSubItem[] | null }): Promise<void> {
  const itemRef = doc(db, BUDGET_ITEMS_COLLECTION, id);
  // The hook now calculates the total, so we just need to save it.
  await updateDoc(itemRef, itemData);
}

export async function copyBudgetItemToNextMonth(db: Firestore, budgetItem: MonthlyBudgetItem): Promise<void> {
  const nextMonth = format(addMonths(new Date(), 1), 'yyyy-MM');
  const q = query(collection(db, BUDGET_ITEMS_COLLECTION), where('month', '==', nextMonth), where('categoryId', '==', budgetItem.categoryId));
  const querySnapshot = await getDocs(q);

  const dataToSave = {
    ...budgetItem,
    month: nextMonth,
  };
  delete (dataToSave as any).id; // Don't copy the ID

  if (querySnapshot.empty) {
    await addDoc(collection(db, BUDGET_ITEMS_COLLECTION), dataToSave);
  } else {
    const docRef = querySnapshot.docs[0].ref;
    await updateDoc(docRef, dataToSave);
  }
}

export async function cycleToNextMonth(db: Firestore): Promise<void> {
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
  await cycleOverviewItems(db, 'Pre-Authorized Payments');
  await cycleOverviewItems(db, 'Debt Payments');
  // Sync automatic transfer amounts for the new current month
  await syncSinkingFundsBudget(undefined, true);
  await syncWealthsimpleTransfer();
}


// ===== Transactions & Accounts =====

export async function getAccountDetails(db: Firestore, accountId: string): Promise<AccountDetails | null> {
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

export async function getTransactionsForMonth(db: Firestore, month: string): Promise<Transaction[]> {
  const parts = month.split('-');
  const year = parseInt(parts[0], 10);
  const mValue = parseInt(parts[1], 10);
  const startDate = new Date(year, mValue - 1, 1);
  
  const startString = `${month}-01`;
  const nextMonthDate = addMonths(startDate, 1);
  const nextMonthString = format(nextMonthDate, 'yyyy-MM-dd');

  const q = query(
    collection(db, TRANSACTIONS_COLLECTION), 
    where('date', '>=', startString),
    where('date', '<', nextMonthString),
    orderBy('date', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
}

export async function getTransactionsByDateRange(db: Firestore, startDate: string, endDate: string): Promise<Transaction[]> {
  const q = query(
    collection(db, TRANSACTIONS_COLLECTION),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc')
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
}


export async function getTransactionsForAccount(db: Firestore, accountId: string): Promise<Transaction[]> {
    // This query is difficult because Firestore cannot query for a specific element in an array of objects.
    // A better approach is to fetch all transactions for the month and filter client-side, 
    // but for now we will fetch all and filter here.
    const allTransactionsSnapshot = await getDocs(collection(db, TRANSACTIONS_COLLECTION));

    const transactionsMap = new Map<string, Transaction>();
    
    allTransactionsSnapshot.docs.forEach(doc => {
        const tx = { id: doc.id, ...doc.data() } as Transaction;
        const isSource = tx.sourceAccountId === accountId;
        const isDestination = (tx.splits || []).some(s => (s.type === 'transfer' || s.type === 'income') && s.destinationAccountId === accountId);
        
        if (isSource || isDestination) {
            if (!transactionsMap.has(doc.id)) {
                transactionsMap.set(doc.id, tx);
            }
        }
    });

    const relevantTransactions = Array.from(transactionsMap.values());

    return relevantTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function stripUndefined(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => stripUndefined(item));
  } else if (obj !== null && typeof obj === 'object') {
    const result: any = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined) {
        result[key] = stripUndefined(obj[key]);
      }
    });
    return result;
  }
  return obj;
}

export async function addTransaction(db: Firestore, transactionData: Partial<Omit<Transaction, 'id'>>, skipPaAutoResolve = false): Promise<Transaction> {
    const cleanData = stripUndefined(transactionData) as Partial<Omit<Transaction, 'id'>>;
    const newDocRef = await runTransaction(db, async (transaction) => {
        const { sourceAccountId, amount, splits, paidById } = cleanData;
        
        const accountIds = new Set<string>();
        if (paidById) accountIds.add(paidById);
        if (sourceAccountId) accountIds.add(sourceAccountId);
        splits?.forEach(s => {
            if(s.destinationAccountId) accountIds.add(s.destinationAccountId);
        });

        const accountRefs = Array.from(accountIds).map(id => doc(db, ACCOUNTS_COLLECTION, id));
        const accountSnaps = await Promise.all(accountRefs.map(ref => transaction.get(ref)));
        const accountSnapsMap = new Map(accountSnaps.map(snap => [snap.id, snap]));

        const newTransactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
        transaction.set(newTransactionRef, cleanData);
        
        const offsets = new Map<string, number>();
        calculateApplyOffsets(cleanData as Transaction, accountSnapsMap, offsets);
        for (const [accId, offset] of offsets.entries()) {
            const snap = accountSnapsMap.get(accId)!;
            const currentBalance = (snap.data() as AccountDetails).balance || 0;
            transaction.update(snap.ref, { balance: currentBalance + offset });
        }
        
        return newTransactionRef;
    });

    // Post-transaction: Mark PA payments as complete. This is not atomic with the transaction, but it's safer.
     if (!skipPaAutoResolve && transactionData.splits) {
        const categoryIds = transactionData.splits
            .filter(s => s.type === 'expense' && s.categoryId)
            .map(s => s.categoryId as string)
            .filter(id => id.trim() !== '');

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
    if (transactionData.payee) {
        const payeeName = transactionData.payee.trim();
        if (payeeName) {
            const payeesQuery = query(collection(db, 'payees'), where('name', '==', payeeName), limit(1));
            const payeesSnap = await getDocs(payeesQuery);
            if (payeesSnap.empty) {
                await addDoc(collection(db, 'payees'), { name: payeeName, createdAt: new Date().toISOString() });
            }
        }
    }

    const docSnap = await getDoc(newDocRef);
    return { id: docSnap.id, ...(docSnap.data() as Omit<Transaction, 'id'>) };
}

function calculateRevertOffsets(oldData: Transaction, accountSnaps: Map<string, DocumentSnapshot>, offsets: Map<string, number>) {
    const effectiveSourceId = oldData.paidById || oldData.sourceAccountId;
    if (effectiveSourceId) {
        const sourceSnap = accountSnaps.get(effectiveSourceId);
        if (sourceSnap?.exists()) {
            const current = offsets.get(effectiveSourceId) || 0;
            offsets.set(effectiveSourceId, current + oldData.amount);
        }
    }
    
    for (const split of (oldData.splits || [])) {
        if ((split.type === 'transfer' || split.type === 'income') && split.destinationAccountId) {
            const destSnap = accountSnaps.get(split.destinationAccountId);
            if(destSnap?.exists()) {
                const current = offsets.get(split.destinationAccountId) || 0;
                offsets.set(split.destinationAccountId, current - split.amount);
            }
        }
    }
}

function calculateApplyOffsets(newData: Transaction, accountSnaps: Map<string, DocumentSnapshot>, offsets: Map<string, number>) {
    const effectiveSourceId = newData.paidById || newData.sourceAccountId;
    if (effectiveSourceId) {
        const sourceSnap = accountSnaps.get(effectiveSourceId);
        if (sourceSnap?.exists()) {
            const current = offsets.get(effectiveSourceId) || 0;
            offsets.set(effectiveSourceId, current - newData.amount);
        }
    }
    
    for (const split of (newData.splits || [])) {
        if ((split.type === 'transfer' || split.type === 'income') && split.destinationAccountId) {
            if (split.destinationAccountId === effectiveSourceId) continue;
            
            const destSnap = accountSnaps.get(split.destinationAccountId);
            if (destSnap?.exists()) {
                const current = offsets.get(split.destinationAccountId) || 0;
                offsets.set(split.destinationAccountId, current + split.amount);
            }
        }
    }
}


export async function updateTransaction(db: Firestore, id: string, transactionData: Partial<Omit<Transaction, 'id'>>): Promise<void> {
    const cleanData = stripUndefined(transactionData);
    await runTransaction(db, async (transaction) => {
        // --- Start READS ---
        const transactionRef = doc(db, TRANSACTIONS_COLLECTION, id);
        const transactionSnap = await transaction.get(transactionRef);
        if (!transactionSnap.exists()) {
            throw new Error("Transaction not found.");
        }
        const oldData = { id, ...transactionSnap.data() } as Transaction;
        
        const newData: Transaction = {
            ...oldData,
            ...cleanData,
            id: id,
        };
        
        const accountIds = new Set<string>();
        if (oldData.paidById) accountIds.add(oldData.paidById);
        if (oldData.sourceAccountId) accountIds.add(oldData.sourceAccountId);
        if (newData.paidById) accountIds.add(newData.paidById);
        if (newData.sourceAccountId) accountIds.add(newData.sourceAccountId);
        [...(oldData.splits || []), ...(newData.splits || [])].forEach(s => {
            if (s.destinationAccountId) {
                accountIds.add(s.destinationAccountId);
            }
        });
        
        accountIds.delete(''); // remove any empty strings
 
        const accountRefs = Array.from(accountIds).map(accId => doc(db, ACCOUNTS_COLLECTION, accId));
        const accountSnaps = await Promise.all(accountRefs.map(ref => transaction.get(ref)));
        const accountSnapsMap = new Map(accountSnaps.map(snap => [snap.id, snap]));
        // --- End READS ---
 
        // --- Start WRITES ---
        const offsets = new Map<string, number>();
        calculateRevertOffsets(oldData, accountSnapsMap, offsets);
        calculateApplyOffsets(newData, accountSnapsMap, offsets);
        for (const [accId, offset] of offsets.entries()) {
            const snap = accountSnapsMap.get(accId)!;
            const currentBalance = (snap.data() as AccountDetails).balance || 0;
            transaction.update(snap.ref, { balance: currentBalance + offset });
        }
        
        transaction.update(transactionRef, cleanData);
    });
 
    if (cleanData.payee) {
        const payeeName = cleanData.payee.trim();
        if (payeeName) {
            const payeesQuery = query(collection(db, 'payees'), where('name', '==', payeeName), limit(1));
            const payeesSnap = await getDocs(payeesQuery);
            if (payeesSnap.empty) {
                await addDoc(collection(db, 'payees'), { name: payeeName, createdAt: new Date().toISOString() });
            }
        }
    }
}

export async function deleteTransaction(db: Firestore, id: string): Promise<void> {
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
        if (oldData.paidById) accountIds.add(oldData.paidById);
        if (oldData.sourceAccountId) accountIds.add(oldData.sourceAccountId);
        (oldData.splits || []).forEach(s => {
            if (s.destinationAccountId) {
                accountIds.add(s.destinationAccountId);
            }
        });

        accountIds.delete(''); // remove any empty strings

        const accountRefs = Array.from(accountIds).map(accId => doc(db, ACCOUNTS_COLLECTION, accId));
        const accountSnaps = await Promise.all(accountRefs.map(ref => transaction.get(ref)));
        const accountSnapsMap = new Map(accountSnaps.map(snap => [snap.id, snap]));
        // --- End READS ---
        
        // --- Start WRITES ---
        const offsets = new Map<string, number>();
        calculateRevertOffsets(oldData, accountSnapsMap, offsets);
        for (const [accId, offset] of offsets.entries()) {
            const snap = accountSnapsMap.get(accId)!;
            const currentBalance = (snap.data() as AccountDetails).balance || 0;
            transaction.update(snap.ref, { balance: currentBalance + offset });
        }
        transaction.delete(transactionRef);
    });
}

export async function initializeMonthBudget(db: Firestore, targetMonth: string): Promise<void> {
  const targetQuery = query(collection(db, BUDGET_ITEMS_COLLECTION), where('month', '==', targetMonth));
  const targetSnapshot = await getDocs(targetQuery);

  // Fetch all budget categories to find debt payment category IDs
  const categoriesQuery = query(collection(db, 'budget-categories'));
  const categoriesSnapshot = await getDocs(categoriesQuery);
  const debtCategoryIds = new Set<string>();
  categoriesSnapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    if (['Credit Cards', 'Loans', 'Line of Credit'].includes(data.name)) {
      debtCategoryIds.add(docSnap.id);
    }
  });

  // Filter out sinking funds and debt payment category items to check if other budget categories are initialized
  const otherItems = targetSnapshot.docs.filter(docSnap => {
    const catId = (docSnap.data() as MonthlyBudgetItem).categoryId;
    return catId !== SINKING_FUNDS_CATEGORY_ID && !debtCategoryIds.has(catId);
  });

  // Always sync sinking funds and debt payments budget to ensure the target month is up-to-date
  await syncSinkingFundsBudget(targetMonth);
  await syncDebtPaymentsToMonthlyBudget(targetMonth);

  // If other categories have already been initialized, we don't need to copy recurring items again
  if (otherItems.length > 0) {
    return;
  }

  // Parse the target month safely in the local timezone
  const parts = targetMonth.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const targetDate = new Date(year, month - 1, 1);
  const prevMonthDate = addMonths(targetDate, -1);
  const prevMonthString = format(prevMonthDate, 'yyyy-MM');

  const prevQuery = query(collection(db, BUDGET_ITEMS_COLLECTION), where('month', '==', prevMonthString));
  const prevSnapshot = await getDocs(prevQuery);
  if (prevSnapshot.empty) {
    return; // No previous month data
  }

  const batch = writeBatch(db);
  let hasWrites = false;

  prevSnapshot.forEach(docSnap => {
    const data = docSnap.data() as MonthlyBudgetItem;
    
    // Skip copying sinking funds or debt categories, as they are synced separately from worksheets
    if (data.categoryId === SINKING_FUNDS_CATEGORY_ID || debtCategoryIds.has(data.categoryId)) {
      return;
    }

    if (data.breakdown && data.breakdown.length > 0) {
      const recurringSubItems = data.breakdown
        .filter(sub => sub.recurring !== false)
        .map(sub => {
          const baseAmt = sub.defaultAmount !== undefined && sub.defaultAmount !== null ? sub.defaultAmount : sub.amount;
          return {
            ...sub,
            amount: baseAmt,
            defaultAmount: baseAmt
          };
        });
        
      if (recurringSubItems.length > 0) {
        const newBudgeted = recurringSubItems.reduce((sum, item) => sum + (item.amount || 0), 0);
        const newDocRef = doc(collection(db, BUDGET_ITEMS_COLLECTION));
        batch.set(newDocRef, {
          categoryId: data.categoryId,
          month: targetMonth,
          budgeted: newBudgeted,
          breakdown: recurringSubItems
        });
        hasWrites = true;
      }
    }
  });

  if (hasWrites) {
    await batch.commit();
    console.log(`Initialized budget for ${targetMonth} with recurring items.`);
  }
}

export async function checkAndAutoCycle(db: Firestore): Promise<void> {
  if (typeof window === 'undefined') return;
  const today = new Date();
  const currentMonthStr = format(today, 'yyyy-MM');
  const lastCycled = localStorage.getItem('budget_last_cycled_month');
  
  if (lastCycled && lastCycled !== currentMonthStr) {
    console.log(`Auto-cycling overview items for the new month: ${currentMonthStr}`);
    const batch = writeBatch(db);
    const qOverview = query(
      collection(db, 'budget-items'), 
      where('type', 'in', ['Pre-Authorized Payments', 'Debt Payments'])
    );
    const snapshot = await getDocs(qOverview);
    snapshot.forEach(docSnap => {
      batch.update(docSnap.ref, { completed: false });
    });
    
    await batch.commit();
    console.log(`Successfully reset checklist items for the new month.`);
  }
  
  localStorage.setItem('budget_last_cycled_month', currentMonthStr);
}
