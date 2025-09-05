


'use server';

import { db } from '@/lib/firebase';
import type { BudgetItem, Debt, AccountDetails, MonthlyBudgetItem } from '@/types';
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
  runTransaction,
} from 'firebase/firestore';
import { isSameMonth, startOfMonth, getDate, getMonth, getYear, set, addWeeks, isAfter, isBefore, isLastDayOfMonth, lastDayOfMonth, addMonths, startOfDay } from 'date-fns';

const BUDGET_COLLECTION = 'budget-items';
const MONTHLY_BUDGET_COLLECTION = 'monthly-budget-items';


export async function getBudgetItems(): Promise<BudgetItem[]> {
  const budgetCollection = collection(db, BUDGET_COLLECTION);
  const q = query(budgetCollection, where('type', 'in', ['Income', 'Pre-Authorized Payments', 'Transfers', 'Debt Payments']));
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

async function updateMonthlyBudget(
  transaction: FirebaseFirestore.Transaction,
  categoryId: string,
  amount: number,
  operation: 'add' | 'subtract'
) {
  if (!categoryId) return;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const q = query(
    collection(db, MONTHLY_BUDGET_COLLECTION),
    where('categoryId', '==', categoryId),
    where('month', '==', currentMonth)
  );

  const querySnapshot = await getDocs(q); // Firestore requires getDocs inside transactions
  let budgetItemRef, currentBudgeted;
  
  if (querySnapshot.empty) {
    budgetItemRef = doc(collection(db, MONTHLY_BUDGET_COLLECTION));
    currentBudgeted = 0;
  } else {
    const budgetDoc = querySnapshot.docs[0];
    budgetItemRef = budgetDoc.ref;
    currentBudgeted = (budgetDoc.data() as MonthlyBudgetItem).budgeted || 0;
  }

  const newBudgeted = operation === 'add' ? currentBudgeted + amount : currentBudgeted - amount;
  
  if (querySnapshot.empty) {
    transaction.set(budgetItemRef, {
        categoryId,
        month: currentMonth,
        budgeted: newBudgeted,
    });
  } else {
    transaction.update(budgetItemRef, { budgeted: newBudgeted });
  }
}

export async function addBudgetItem(itemData: Omit<BudgetItem, 'id'>): Promise<BudgetItem> {
  const dataWithCompleted = { ...itemData, completed: false, forNextMonth: itemData.forNextMonth || false };
  
  const docRef = await runTransaction(db, async (transaction) => {
    if (itemData.type === 'Pre-Authorized Payments' && itemData.budgetCategoryId) {
      await updateMonthlyBudget(transaction, itemData.budgetCategoryId, itemData.amount, 'add');
    }
    const newDocRef = doc(collection(db, BUDGET_COLLECTION));
    transaction.set(newDocRef, dataWithCompleted);
    return newDocRef;
  });

  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<BudgetItem, 'id'>) };
}


export async function updateBudgetItem(id: string, itemData: Partial<Omit<BudgetItem, 'id' | 'originalId'>>): Promise<void> {
    await runTransaction(db, async (transaction) => {
        const isRecurringInstance = id.includes('-');
        
        if (isRecurringInstance) {
            const [baseId] = id.split('-');
            const originalItemRef = doc(db, BUDGET_COLLECTION, baseId);
            const originalItemSnap = await transaction.get(originalItemRef);

            if (originalItemSnap.exists()) {
                const originalItemData = originalItemSnap.data() as BudgetItem;
                const q = query(collection(db, BUDGET_COLLECTION), where('originalId', '==', id));
                const existingOverrideSnap = await getDocs(q); // Needs to be getDocs

                let oldItemData = originalItemData;

                if (!existingOverrideSnap.empty) {
                    const overrideDocRef = existingOverrideSnap.docs[0].ref;
                    oldItemData = { ...oldItemData, ...(existingOverrideSnap.docs[0].data() as BudgetItem) };
                    transaction.update(overrideDocRef, itemData);
                } else {
                    const newDocData: Omit<BudgetItem, 'id'> & { originalId: string } = {
                        ...originalItemData, ...itemData, frequency: 'One-Time', originalId: id,
                        date: new Date(parseInt(id.split('-')[1])).toISOString(),
                        completed: itemData.completed ?? false,
                    };
                    if (itemData.date) newDocData.date = itemData.date;
                    const newDocRef = doc(collection(db, BUDGET_COLLECTION));
                    transaction.set(newDocRef, newDocData);
                }
                
                // Adjust budget if category or amount changed for a PA payment
                if (oldItemData.type === 'Pre-Authorized Payments') {
                    const oldAmount = oldItemData.amount;
                    const newAmount = itemData.amount ?? oldAmount;
                    const oldCategoryId = oldItemData.budgetCategoryId;
                    const newCategoryId = itemData.budgetCategoryId === undefined ? oldCategoryId : itemData.budgetCategoryId;

                    if (oldCategoryId !== newCategoryId || oldAmount !== newAmount) {
                        if (oldCategoryId) await updateMonthlyBudget(transaction, oldCategoryId, oldAmount, 'subtract');
                        if (newCategoryId) await updateMonthlyBudget(transaction, newCategoryId, newAmount, 'add');
                    }
                }
            }
        } else {
            const itemRef = doc(db, BUDGET_COLLECTION, id);
            const docSnap = await transaction.get(itemRef);
            if (docSnap.exists()) {
                const oldItemData = docSnap.data() as BudgetItem;
                transaction.update(itemRef, itemData);

                if (oldItemData.type === 'Pre-Authorized Payments') {
                    const oldAmount = oldItemData.amount;
                    const newAmount = itemData.amount ?? oldAmount;
                    const oldCategoryId = oldItemData.budgetCategoryId;
                    const newCategoryId = itemData.budgetCategoryId === undefined ? oldCategoryId : itemData.budgetCategoryId;

                    if (oldCategoryId !== newCategoryId || oldAmount !== newAmount) {
                        if (oldCategoryId) await updateMonthlyBudget(transaction, oldCategoryId, oldAmount, 'subtract');
                        if (newCategoryId) await updateMonthlyBudget(transaction, newCategoryId, newAmount, 'add');
                    }
                }
            } else {
                throw new Error(`Budget item with id ${id} not found.`);
            }
        }
    });
}


export async function deleteBudgetItem(id: string): Promise<void> {
    await runTransaction(db, async (transaction) => {
        const isRecurringInstance = id.includes('-');
        
        let itemToDeleteRef: FirebaseFirestore.DocumentReference | undefined;
        let itemToDeleteData: BudgetItem | null = null;
        
        if (isRecurringInstance) {
            const q = query(collection(db, BUDGET_COLLECTION), where('originalId', '==', id));
            const querySnapshot = await getDocs(q); // getDocs needed for transaction
            if (!querySnapshot.empty) {
                const docToDelete = querySnapshot.docs[0];
                itemToDeleteRef = docToDelete.ref;
                itemToDeleteData = docToDelete.data() as BudgetItem;
            } else {
                const baseId = id.split('-')[0];
                const originalItemRef = doc(db, BUDGET_COLLECTION, baseId);
                const originalItemSnap = await transaction.get(originalItemRef);
                if (originalItemSnap.exists()) {
                    itemToDeleteData = originalItemSnap.data() as BudgetItem;
                     // For a virtual instance, the date is encoded in the ID
                    itemToDeleteData.date = new Date(parseInt(id.split('-')[1])).toISOString();
                }
            }
        } else {
            itemToDeleteRef = doc(db, BUDGET_COLLECTION, id);
            const docSnap = await transaction.get(itemToDeleteRef);
            if (docSnap.exists()) {
                itemToDeleteData = docSnap.data() as BudgetItem;
            }
        }

        if (itemToDeleteData) {
            if (itemToDeleteData.type === 'Pre-Authorized Payments' && itemToDeleteData.budgetCategoryId) {
                await updateMonthlyBudget(transaction, itemToDeleteData.budgetCategoryId, itemToDeleteData.amount, 'subtract');
            }
            if (itemToDeleteRef) {
                 transaction.delete(itemToDeleteRef);
            }
        }

        // Handle deleting base item and its modified instances
        if (!isRecurringInstance) {
            const baseId = id;
            const q = query(collection(db, BUDGET_COLLECTION), where('originalId', '>=', baseId + '-'), where('originalId', '<', baseId + '-z'));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach(doc => {
                transaction.delete(doc.ref);
            });
        }
    });
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
