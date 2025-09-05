

'use server';

import { db } from '@/lib/firebase';
import type { BudgetItem, Debt, AccountDetails } from '@/types';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  query,
  getDoc,
  addDoc,
  where,
  writeBatch,
  updateDoc,
  orderBy,
} from 'firebase/firestore';
import { isSameMonth, startOfMonth, getDate, getMonth, getYear, set, addWeeks, isAfter, isBefore, isLastDayOfMonth, lastDayOfMonth, addMonths, startOfDay } from 'date-fns';

const BUDGET_COLLECTION = 'budget-items';
const DEBT_COLLECTION = 'debts';
const ACCOUNT_DETAILS_COLLECTION = 'transferees';


export async function getBudgetItems(): Promise<BudgetItem[]> {
  const budgetCollection = collection(db, BUDGET_COLLECTION);
  const q = query(budgetCollection);
  const querySnapshot = await getDocs(q);
  
  const today = new Date();
  const allGeneratedItems: BudgetItem[] = [];
  const startOfCurrentMonth = startOfMonth(today);
  const endOfCurrentMonth = lastDayOfMonth(today);
  const processedRecurringInstances = new Set<string>();

  const allItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetItem));

  // First, find all modified one-time items for the current month
  const modifiedItemsInMonth = allItems.filter(item => 
      item.originalId && isSameMonth(new Date(item.date), today)
  );

  modifiedItemsInMonth.forEach(item => {
      allGeneratedItems.push(item);
      // Keep track of which original instances have been processed
      if (item.originalId) {
          processedRecurringInstances.add(item.originalId);
      }
  });

  allItems.forEach(item => {
    // Skip modified items as they are already handled
    if (item.originalId) return;

    if (item.completed === undefined) {
      item.completed = false;
    }

    const itemStartDate = new Date(item.date);
    
    // For "Debt Payments" and "Transfers", we want to show all of them, regardless of date.
    if (item.type === 'Debt Payments' || item.type === 'Transfers') {
        allGeneratedItems.push(item);
        return; // Move to the next item
    }

    // Existing logic for other types (Income, PA Payments)
    if (getYear(itemStartDate) > getYear(today) || (getYear(itemStartDate) === getYear(today) && getMonth(itemStartDate) > getMonth(today))) {
        if (item.frequency === 'One-Time' && isSameMonth(itemStartDate, today)) {
            // allow
        } else {
            return;
        }
    }
    
    if (item.frequency === 'One-Time') {
      if (isSameMonth(itemStartDate, today) && !allGeneratedItems.some(i => i.id === item.id)) {
        allGeneratedItems.push(item);
      }
    } else if (item.frequency === 'Monthly' || item.frequency === 'Monthly (Last Day)') {
        let currentDate;
        if (item.frequency === 'Monthly (Last Day)') {
            currentDate = lastDayOfMonth(startOfCurrentMonth);
        } else {
             // Handle regular monthly items
            let tempDate = startOfDay(itemStartDate);
            while (isBefore(tempDate, startOfCurrentMonth)) {
                tempDate = addMonths(tempDate, 1);
            }
            currentDate = tempDate;
        }

        if (isSameMonth(currentDate, today)) {
            const instanceId = `${item.id}-${currentDate.getTime()}`;
             if (!processedRecurringInstances.has(instanceId)) {
                allGeneratedItems.push({
                    ...item,
                    id: instanceId,
                    date: currentDate.toISOString(),
                    completed: item.completed || false
                });
            }
        }
    } else if (item.frequency === 'Weekly' || item.frequency === 'Bi-Weekly') {
      let currentDate = itemStartDate;
      const increment = item.frequency === 'Weekly' ? 1 : 2;

      while (isBefore(currentDate, startOfCurrentMonth)) {
        currentDate = addWeeks(currentDate, increment);
      }
      
      while (isSameMonth(currentDate, today)) {
          const instanceId = `${item.id}-${currentDate.getTime()}`;
          if (isAfter(currentDate, itemStartDate) || isSameMonth(itemStartDate, currentDate)) {
              if (!processedRecurringInstances.has(instanceId)) {
                allGeneratedItems.push({
                    ...item,
                    id: instanceId, 
                    date: currentDate.toISOString(),
                    completed: item.completed || false
                });
              }
          }
          currentDate = addWeeks(currentDate, increment);
      }
    }
  });


  return allGeneratedItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function addBudgetItem(itemData: Omit<BudgetItem, 'id'>): Promise<BudgetItem> {
  const dataWithCompleted = { ...itemData, completed: false, forNextMonth: itemData.forNextMonth || false };
  const docRef = await addDoc(collection(db, BUDGET_COLLECTION), dataWithCompleted);
  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<BudgetItem, 'id'>) };
}

export async function updateBudgetItem(id: string, itemData: Partial<Omit<BudgetItem, 'id' | 'originalId'>>): Promise<void> {
    const isRecurringInstance = id.includes('-');
    
    if (isRecurringInstance) {
        const [baseId] = id.split('-');
        const originalItemRef = doc(db, BUDGET_COLLECTION, baseId);
        const originalItemSnap = await getDoc(originalItemRef);

        if (originalItemSnap.exists()) {
            const originalItemData = originalItemSnap.data();

            // Check if an overridden item already exists for this instance
            const q = query(collection(db, BUDGET_COLLECTION), where('originalId', '==', id));
            const existingOverrideSnap = await getDocs(q);

            if (!existingOverrideSnap.empty) {
                // Update the existing override document
                const overrideDocRef = existingOverrideSnap.docs[0].ref;
                await updateDoc(overrideDocRef, itemData);
            } else {
                // Create a new override document
                const newDocData: Omit<BudgetItem, 'id'> & { originalId: string } = {
                    ...(originalItemData as BudgetItem),
                    ...itemData,
                    frequency: 'One-Time', 
                    originalId: id,
                    date: new Date(parseInt(id.split('-')[1])).toISOString(),
                    completed: itemData.completed ?? false,
                };
                // Ensure the date from the edited item is used if provided
                if (itemData.date) {
                    newDocData.date = itemData.date;
                }
                await addDoc(collection(db, BUDGET_COLLECTION), newDocData);
            }
        }
    } else {
        // This is a base item or a one-off item
        const itemRef = doc(db, BUDGET_COLLECTION, id);
        const docSnap = await getDoc(itemRef);
        if (docSnap.exists()) {
            await updateDoc(itemRef, itemData);
        } else {
            throw new Error(`Budget item with id ${id} not found.`);
        }
    }
}

export async function deleteBudgetItem(id: string): Promise<void> {
  const isRecurringInstance = id.includes('-');
  
  if (isRecurringInstance) {
    // This is a virtual instance, we only need to delete the modified one-time items if they exist.
     const q = query(collection(db, BUDGET_COLLECTION), where('originalId', '==', id));
     const querySnapshot = await getDocs(q);
     if (!querySnapshot.empty) {
         await deleteDoc(querySnapshot.docs[0].ref);
     }
     // If no modified version exists, there's nothing in the DB to delete for this instance.
     return;
  }
  
  // It's a base item. Delete it and all its modified instances.
  const baseId = id;
  const itemRef = doc(db, BUDGET_COLLECTION, baseId);
  
  const batch = writeBatch(db);

  // This query is too broad, it can delete other items' instances.
  // We need to be more specific. Let's find docs where originalId starts with baseId.
  const q = query(collection(db, BUDGET_COLLECTION), where('originalId', '>=', baseId + '-'), where('originalId', '<', baseId + '-z'));

  const querySnapshot = await getDocs(q);
  querySnapshot.forEach(doc => {
    if (doc.data().originalId.startsWith(baseId + '-')) {
      batch.delete(doc.ref);
    }
  });
  
  const docSnap = await getDoc(itemRef);
  if (docSnap.exists()) {
    batch.delete(itemRef);
  }

  await batch.commit();
}


export async function syncDebtPayments(): Promise<void> {
  const debtCollectionRef = collection(db, DEBT_COLLECTION);
  const budgetCollectionRef = collection(db, BUDGET_COLLECTION);
  const accountsCollectionRef = collection(db, ACCOUNT_DETAILS_COLLECTION);
  const batch = writeBatch(db);

  // 1. Get all debts from the debt worksheet
  const debtSnapshot = await getDocs(query(debtCollectionRef, orderBy('order')));
  const debts = debtSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt));

  // Get all accounts to find linked ones
  const accountsSnapshot = await getDocs(accountsCollectionRef);
  const accounts = accountsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccountDetails));
  const accountMap = new Map(accounts.map(acc => [acc.id, acc]));

  // 2. Get all existing debt payments from the budget to delete them
  const existingBudgetPaymentsQuery = query(budgetCollectionRef, where('type', '==', 'Debt Payments'));
  const existingBudgetPaymentsSnapshot = await getDocs(existingBudgetPaymentsQuery);

  existingBudgetPaymentsSnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });

  // 3. Create new budget items for each debt
  debts.forEach(debt => {
    if (debt.actualPayment > 0) {
      const linkedAccount = accounts.find(acc => acc.linkedDebtId === debt.id);
      
      const budgetItemData: Omit<BudgetItem, 'id'> = {
        type: 'Debt Payments',
        description: debt.name,
        amount: debt.actualPayment,
        date: debt.dueDate,
        frequency: 'One-Time',
        category: 'N/A',
        completed: false,
        transferFrom: linkedAccount ? linkedAccount.name : 'Unknown', // Use linked account name as source
      };
      const newDocRef = doc(budgetCollectionRef);
      batch.set(newDocRef, budgetItemData);
    }
  });

  // 4. Commit all the changes at once
  await batch.commit();
}

export async function clearDebtPayments(): Promise<void> {
  const budgetCollectionRef = collection(db, BUDGET_COLLECTION);
  const batch = writeBatch(db);

  // Get all existing debt payments from the budget to delete them
  const existingBudgetPaymentsQuery = query(budgetCollectionRef, where('type', '==', 'Debt Payments'));
  const existingBudgetPaymentsSnapshot = await getDocs(existingBudgetPaymentsQuery);
  
  existingBudgetPaymentsSnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();
}

export async function resetPaPayments(): Promise<void> {
  const batch = writeBatch(db);
  
  // First, delete all modified one-time instances of PA payments to clean up
  const modifiedQuery = query(collection(db, BUDGET_COLLECTION), where('type', '==', 'Pre-Authorized Payments'), where('originalId', '!=', null));
  const modifiedSnapshot = await getDocs(modifiedQuery);
  modifiedSnapshot.forEach(doc => {
    batch.delete(doc.ref);
  });

  // Now, update all PA payment items (recurring and one-time)
  const q = query(collection(db, BUDGET_COLLECTION), where('type', '==', 'Pre-Authorized Payments'));
  const querySnapshot = await getDocs(q);
  
  querySnapshot.forEach(docSnap => {
    const item = { id: docSnap.id, ...docSnap.data() } as BudgetItem;
    
    // We only want to update the base items, not the modified instances we just deleted
    if (item.originalId) {
      return; 
    }

    const updatedData: Partial<BudgetItem> = { completed: false };

    if (item.frequency !== 'One-Time') {
      let newDate = new Date(item.date);
      const today = new Date();
      
      // Loop until we find the date for the *next* month or beyond
      while (isBefore(newDate, today) || isSameMonth(newDate, today)) {
        switch (item.frequency) {
          case 'Monthly':
            newDate = addMonths(newDate, 1);
            break;
          case 'Monthly (Last Day)':
            newDate = lastDayOfMonth(addMonths(newDate, 1));
            break;
          case 'Weekly':
            newDate = addWeeks(newDate, 1);
            break;
          case 'Bi-Weekly':
            newDate = addWeeks(newDate, 2);
            break;
          default:
            // This case should not be hit for recurring items, but it's good practice
            break;
        }
      }
      updatedData.date = newDate.toISOString();
    }
    
    batch.update(docSnap.ref, updatedData);
  });

  await batch.commit();
}

    