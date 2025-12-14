
'use client';

import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { Expense, MileageLog, Honorarium, AccountLedgerItem, UploadableFile } from '@/types';
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
  Firestore
} from 'firebase/firestore';
import { createAutomatedBackup } from '@/services/backup-service';

const EXPENSE_COLLECTION = 'expenses';
const LEDGER_ITEMS_COLLECTION = 'account-ledger-items';

// Helper function to convert data URI to Blob
function dataURItoBlob(dataURI: string) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
}


export async function getActiveMonetaryExpenses(db: Firestore): Promise<Expense[]> {
  const q = query(
    collection(db, EXPENSE_COLLECTION),
    where('type', '==', 'Monetary'),
    where('status', '==', 'active')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
}

export async function getHonorariums(db: Firestore, status: 'active' | 'archived', archiveKey?: string): Promise<Honorarium[]> {
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

export async function addExpense(db: Firestore, storage: any, itemData: Omit<Expense, 'id'>, ledgerAccountId?: string, receiptFile?: UploadableFile | null): Promise<Expense> {
  let receiptUrl: string | null = null;
  
  if (receiptFile?.data) {
    const storageRef = ref(storage, `receipts/${new Date().toISOString()}_${receiptFile.name}`);
    const blob = dataURItoBlob(receiptFile.data);
    await uploadBytes(storageRef, blob, { contentType: receiptFile.type });
    receiptUrl = await getDownloadURL(storageRef);
  }

  const dataToSave: Omit<Expense, 'id'> = {
    ...itemData,
    status: 'active',
    forNextMonth: itemData.forNextMonth || false,
    receiptUrl: receiptUrl,
  };

  const newExpenseRef = await addDoc(collection(db, EXPENSE_COLLECTION), dataToSave);

  if (ledgerAccountId && !itemData.forNextMonth) {
    await runTransaction(db, async (transaction) => {
      const ledgerItemRef = doc(db, LEDGER_ITEMS_COLLECTION, ledgerAccountId);
      const ledgerItemSnap = await transaction.get(ledgerItemRef);
      if (!ledgerItemSnap.exists()) {
        throw new Error(`Ledger item with id ${ledgerAccountId} not found.`);
      }
      const ledgerItemData = ledgerItemSnap.data() as AccountLedgerItem;
      const newBalance = ledgerItemData.amount - (itemData.amount || 0);
      transaction.update(ledgerItemRef, { amount: newBalance });
    });
  }

  return { id: newExpenseRef.id, ...dataToSave };
}


export async function addHonorarium(db: Firestore, itemData: Omit<Honorarium, 'id'>): Promise<Honorarium> {
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

export async function updateExpense(db: Firestore, id: string, itemData: Partial<Omit<Expense, 'id' | 'originalId'>>): Promise<void> {
    const itemRef = doc(db, EXPENSE_COLLECTION, id);
    const docSnap = await getDoc(itemRef);
    if (docSnap.exists()) {
        await updateDoc(itemRef, itemData);
    } else {
        throw new Error(`Expense with id ${id} not found.`);
    }
}

export async function deleteExpense(db: Firestore, id: string): Promise<void> {
    const itemRef = doc(db, EXPENSE_COLLECTION, id);
    await deleteDoc(itemRef);
}

export async function updateHonorarium(db: Firestore, id: string, itemData: Partial<Omit<Honorarium, 'id'>>): Promise<void> {
    // This function will need to handle amount changes carefully if it's ever used
    // to prevent desyncing the ledger. For now, it's just for non-amount fields.
    const itemRef = doc(db, EXPENSE_COLLECTION, id);
    await updateDoc(itemRef, itemData);
}

export async function deleteHonorarium(db: Firestore, id: string): Promise<void> {
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
export async function getArchivedMonths(db: Firestore): Promise<string[]> {
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

export async function getExpensesForMonth(db: Firestore, archiveKey: string): Promise<{ expenses: Expense[], mileageLogs: MileageLog[], honorariums: Honorarium[] }> {
  const expenseQuery = query(collection(db, EXPENSE_COLLECTION), where('type', '==', 'Monetary'), where('status', '==', 'archived'), where('archiveKey', '==', archiveKey));
  const honorariumQuery = query(collection(db, EXPENSE_COLLECTION), where('type', '==', 'Honorarium'), where('status', '==', 'archived'), where('archiveKey', '==', archiveKey));
  const mileageQuery = query(collection(db, EXPENSE_COLLECTION), where('type', '==', 'Mileage'), where('status', '==', 'archived'), where('archiveKey', '==', archiveKey));

  const [expenseSnapshot, honorariumSnapshot, mileageSnapshot] = await Promise.all([
      getDocs(expenseQuery),
      getDocs(honorariumQuery),
      getDocs(mileageQuery),
  ]);

  const expenses = expenseSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
  const honorariums = honorariumSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Honorarium));
  const mileageLogs = mileageSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MileageLog))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return { expenses, mileageLogs, honorariums };
}

export async function archiveCurrentExpenses(db: Firestore, archiveKey: string): Promise<void> {
  const batch = writeBatch(db);
  
  const activeQuery = query(collection(db, EXPENSE_COLLECTION), where('status', '==', 'active'), where('forNextMonth', '==', false));

  const activeSnapshot = await getDocs(activeQuery);
  
  activeSnapshot.forEach(doc => {
    const docRef = doc.ref;
    batch.update(docRef, { status: 'archived', archiveKey: archiveKey });
  });
  
  await batch.commit();
}


export async function cycleExpensesToNextMonth(db: Firestore): Promise<void> {
    await createAutomatedBackup('pre-expense-cycle');
    await archiveCurrentExpenses(db, new Date().toISOString().slice(0, 7));
    
    const batch = writeBatch(db);
    const q = query(collection(db, EXPENSE_COLLECTION), where('forNextMonth', '==', true));
    const snapshot = await getDocs(q);

    snapshot.forEach(doc => {
        batch.update(doc.ref, { forNextMonth: false, status: 'active' });
    });

    await batch.commit();
}
