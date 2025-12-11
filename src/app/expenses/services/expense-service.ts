

'use server';

import { db } from '@/lib/firebase';
import type { Expense, MileageLog, Honorarium, AccountLedgerItem } from '@/types';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  getDoc,
  addDoc,
  where,
  writeBatch,
  orderBy,
  runTransaction,
} from 'firebase/firestore';
import { createAutomatedBackup } from '@/services/backup-service';

const EXPENSE_COLLECTION = 'expenses';
const LEDGER_ITEMS_COLLECTION = 'account-ledger-items';


export async function getExpenses(status: 'active' | 'archived', archiveKey?: string): Promise<Expense[]> {
  const expenseCollection = collection(db, EXPENSE_COLLECTION);
  
  let q;
  if (status === 'active') {
    const activeQuery = query(expenseCollection, where('type', '==', 'Monetary'), where('status', '==', 'active'));
    
    const activeSnapshot = await getDocs(activeQuery);
    
    const allItems = activeSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));

    return allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
  } else {
    q = query(expenseCollection, where('type', '==', 'Monetary'), where('status', '==', 'archived'), where('archiveKey', '==', archiveKey));
    const querySnapshot = await getDocs(q);
    const allItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
    return allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}

export async function getHonorariums(status: 'active' | 'archived', archiveKey?: string): Promise<Honorarium[]> {
  const expenseCollection = collection(db, EXPENSE_COLLECTION);
  let q;
  if (status === 'active') {
      q = query(expenseCollection, where('type', '==', 'Honorarium'), where('status', '==', 'active'));
  } else {
      q = query(expenseCollection, where('type', '==', 'Honorarium'), where('status', '==', 'archived'), where('archiveKey', '==', archiveKey));
  }
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Honorarium));
  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}


export async function addExpense(itemData: Omit<Expense, 'id'>, ledgerAccountId?: string): Promise<Expense> {
  const dataWithStatus = { ...itemData, status: 'active', forNextMonth: itemData.forNextMonth || false };
  
  return runTransaction(db, async (transaction) => {
    // 1. READ from the ledger if an ID is provided
    let ledgerItemRef;
    let ledgerItemSnap;
    if (ledgerAccountId && !itemData.forNextMonth) { // Only debit for current month expenses
      ledgerItemRef = doc(db, LEDGER_ITEMS_COLLECTION, ledgerAccountId);
      ledgerItemSnap = await transaction.get(ledgerItemRef);
      if (!ledgerItemSnap.exists()) {
        throw new Error(`Ledger item with id ${ledgerAccountId} not found.`);
      }
    }

    // 2. All reads are done. Now perform WRITES.
    const newExpenseRef = doc(collection(db, EXPENSE_COLLECTION));
    transaction.set(newExpenseRef, dataWithStatus);

    if (ledgerItemRef && ledgerItemSnap) {
      const ledgerItemData = ledgerItemSnap.data() as AccountLedgerItem;
      const newBalance = ledgerItemData.amount - (itemData.amount || 0);
      transaction.update(ledgerItemRef, { amount: newBalance });
    }

    // Return the new expense object without a final read
    return { id: newExpenseRef.id, ...dataWithStatus } as Expense;
  });
}


export async function addHonorarium(itemData: Omit<Honorarium, 'id'>): Promise<Honorarium> {
    const dataWithStatus = { ...itemData, status: 'active' };

    return runTransaction(db, async (transaction) => {
        // --- Start READS ---
        const ledgerQuery = query(collection(db, LEDGER_ITEMS_COLLECTION), where("name", "==", "Honorarium Fund"));
        const ledgerSnapshot = await getDocs(ledgerQuery); 
        
        let ledgerItemRef;
        let currentAmount = 0;
        if (!ledgerSnapshot.empty) {
            const ledgerDoc = ledgerSnapshot.docs[0];
            ledgerItemRef = ledgerDoc.ref;
            currentAmount = (ledgerDoc.data() as AccountLedgerItem).amount || 0;
        } else {
            ledgerItemRef = doc(collection(db, LEDGER_ITEMS_COLLECTION));
        }
        // --- End READS ---


        // --- Start WRITES ---
        const newHonorariumRef = doc(collection(db, EXPENSE_COLLECTION));
        transaction.set(newHonorariumRef, dataWithStatus);
        
        const newBalance = currentAmount + itemData.amount;
        
        if (ledgerSnapshot.empty) {
             transaction.set(ledgerItemRef, { name: "Honorarium Fund", amount: newBalance });
        } else {
             transaction.update(ledgerItemRef, { amount: newBalance });
        }
        // --- End WRITES ---
        
        return { id: newHonorariumRef.id, ...dataWithStatus } as Honorarium;
    });
}

export async function updateExpense(id: string, itemData: Partial<Omit<Expense, 'id' | 'originalId'>>): Promise<void> {
    const itemRef = doc(db, EXPENSE_COLLECTION, id);
    const docSnap = await getDoc(itemRef);
    if (docSnap.exists()) {
        await updateDoc(itemRef, itemData);
    } else {
        throw new Error(`Expense with id ${id} not found.`);
    }
}

export async function deleteExpense(id: string): Promise<void> {
    const itemRef = doc(db, EXPENSE_COLLECTION, id);
    await deleteDoc(itemRef);
}

export async function updateHonorarium(id: string, itemData: Partial<Omit<Honorarium, 'id'>>): Promise<void> {
    // This function will need to handle amount changes carefully if it's ever used
    // to prevent desyncing the ledger. For now, it's just for non-amount fields.
    const itemRef = doc(db, EXPENSE_COLLECTION, id);
    await updateDoc(itemRef, itemData);
}

export async function deleteHonorarium(id: string): Promise<void> {
    const itemRef = doc(db, EXPENSE_COLLECTION, id);
    
    await runTransaction(db, async (transaction) => {
        // --- Start READS ---
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) {
            throw new Error("Honorarium to delete not found.");
        }
        const honorariumToDelete = itemSnap.data() as Honorarium;
        const amountToDelete = honorariumToDelete.amount;

        const ledgerQuery = query(collection(db, LEDGER_ITEMS_COLLECTION), where("name", "==", "Honorarium Fund"));
        const ledgerSnapshot = await getDocs(ledgerQuery);
        const ledgerDoc = ledgerSnapshot.docs[0];
        // --- End READS ---


        // --- Start WRITES ---
        transaction.delete(itemRef);

        if (ledgerDoc) {
            const ledgerItemRef = ledgerDoc.ref;
            const currentAmount = (ledgerDoc.data() as AccountLedgerItem).amount || 0;
            const newBalance = currentAmount - amountToDelete;
            transaction.update(ledgerItemRef, { amount: newBalance < 0 ? 0 : newBalance });
        }
    });
}

// New functions for archiving
export async function getArchivedMonths(): Promise<string[]> {
  const q = query(collection(db, EXPENSE_COLLECTION), where('status', '==', 'archived'));
  const querySnapshot = await getDocs(q);
  const archiveKeys = new Set<string>();
  querySnapshot.forEach(doc => {
    const data = doc.data();
    if (data.archiveKey) {
      archiveKeys.add(data.archiveKey);
    }
  });
  return Array.from(archiveKeys).sort().reverse();
}

export async function getExpensesForMonth(archiveKey: string): Promise<{ expenses: Expense[], mileageLogs: MileageLog[], honorariums: Honorarium[] }> {
  const expenses = await getExpenses('archived', archiveKey);
  const honorariums = await getHonorariums('archived', archiveKey);

  const mileageQuery = query(collection(db, EXPENSE_COLLECTION), where('type', '==', 'Mileage'), where('status', '==', 'archived'), where('archiveKey', '==', archiveKey));
  const mileageSnapshot = await getDocs(mileageQuery);
  const mileageLogs = mileageSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MileageLog))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return { expenses, mileageLogs, honorariums };
}

export async function archiveCurrentExpenses(archiveKey: string): Promise<void> {
  const batch = writeBatch(db);
  
  const activeQuery = query(collection(db, EXPENSE_COLLECTION), where('status', '==', 'active'), where('forNextMonth', '==', false));

  const activeSnapshot = await getDocs(activeQuery);
  
  activeSnapshot.forEach(doc => {
    const docRef = doc.ref;
    batch.update(docRef, { status: 'archived', archiveKey: archiveKey });
  });
  
  await batch.commit();
}


export async function cycleExpensesToNextMonth(): Promise<void> {
    await createAutomatedBackup('pre-expense-cycle');
    await archiveCurrentExpenses(new Date().toISOString().slice(0, 7));
    
    const batch = writeBatch(db);
    const q = query(collection(db, EXPENSE_COLLECTION), where('forNextMonth', '==', true));
    const snapshot = await getDocs(q);

    snapshot.forEach(doc => {
        batch.update(doc.ref, { forNextMonth: false, status: 'active' });
    });

    await batch.commit();
}
