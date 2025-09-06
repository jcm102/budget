

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
  transaction: FirebaseFirestore.Transaction | FirebaseFirestore.WriteBatch,
  categoryId: string,
  paymentItem: { description: string, amount: number },
  operation: 'add' | 'subtract'
) {
  if (!categoryId) return;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const q = query(
    collection(db, MONTHLY_BUDGET_COLLECTION),
    where('categoryId', '==', categoryId),
    where('month', '==', currentMonth)
  );

  const querySnapshot = await getDocs(q); 
  let budgetItemRef, currentBreakdown, currentBudgeted;
  
  if (querySnapshot.empty) {
    if (operation === 'subtract') return; // Cannot subtract from a non-existent budget
    budgetItemRef = doc(collection(db, MONTHLY_BUDGET_COLLECTION));
    currentBreakdown = [];
  } else {
    const budgetDoc = querySnapshot.docs[0];
    budgetItemRef = budgetDoc.ref;
    const data = budgetDoc.data() as MonthlyBudgetItem;
    currentBreakdown = data.breakdown || [];
  }

  let newBreakdown;
  if (operation === 'add') {
    // Remove any existing item with the same name before adding/updating
    const filteredBreakdown = currentBreakdown.filter(item => item.name !== paymentItem.description);
    newBreakdown = [...filteredBreakdown, { name: paymentItem.description, amount: paymentItem.amount }];
  } else { // subtract
    newBreakdown = currentBreakdown.filter(item => item.name !== paymentItem.description);
  }

  const newBudgeted = newBreakdown.reduce((sum, item) => sum + item.amount, 0);

  const dataToSet = {
    categoryId,
    month: currentMonth,
    budgeted: newBudgeted,
    breakdown: newBreakdown,
  };

  if (querySnapshot.empty) {
    transaction.set(budgetItemRef, dataToSet);
  } else {
    transaction.update(budgetItemRef, dataToSet);
  }
}

export async function addBudgetItem(itemData: Omit<BudgetItem, 'id'>): Promise<BudgetItem> {
  const dataWithCompleted = { ...itemData, completed: false, forNextMonth: itemData.forNextMonth || false };
  
  await runTransaction(db, async (transaction) => {
    if (itemData.type === 'Pre-Authorized Payments' && itemData.budgetCategoryId) {
      await updateMonthlyBudget(transaction, itemData.budgetCategoryId, { description: itemData.description, amount: itemData.amount }, 'add');
    }
    const newDocRef = doc(collection(db, BUDGET_COLLECTION));
    transaction.set(newDocRef, dataWithCompleted);
  });

  return { id: 'refetch-to-get-id', ...dataWithCompleted };
}


export async function updateBudgetItem(id: string, itemData: Partial<Omit<BudgetItem, 'id' | 'originalId'>>): Promise<void> {
    await runTransaction(db, async (transaction) => {
        const isRecurringInstance = id.includes('-');
        let oldItemData: BudgetItem | null = null;
        let itemRef;
        
        if (isRecurringInstance) {
            const [baseId] = id.split('-');
            const originalItemRef = doc(db, BUDGET_COLLECTION, baseId);
            const originalItemSnap = await transaction.get(originalItemRef);

            if (originalItemSnap.exists()) {
                const overrideQuery = query(collection(db, BUDGET_COLLECTION), where('originalId', '==', id));
                const existingOverrideSnap = await getDocs(overrideQuery);

                if (!existingOverrideSnap.empty) {
                    itemRef = existingOverrideSnap.docs[0].ref;
                    oldItemData = { ...originalItemSnap.data(), ...existingOverrideSnap.docs[0].data(), id: itemRef.id } as BudgetItem;
                } else {
                    itemRef = doc(collection(db, BUDGET_COLLECTION));
                    oldItemData = { ...originalItemSnap.data(), id: baseId } as BudgetItem;
                    
                    const newDocData: Omit<BudgetItem, 'id'> & { originalId: string } = {
                        ...(originalItemSnap.data() as Omit<BudgetItem, 'id'>),
                        ...itemData,
                        frequency: 'One-Time',
                        originalId: id,
                        date: new Date(parseInt(id.split('-')[1])).toISOString(),
                        completed: itemData.completed ?? false,
                    };
                    if (itemData.date) newDocData.date = itemData.date;
                    
                    // This is a write, so it should be done after all reads
                    // We'll set it at the end
                }
            }
        } else {
            itemRef = doc(db, BUDGET_COLLECTION, id);
            const docSnap = await transaction.get(itemRef);
            if(docSnap.exists()) {
                oldItemData = docSnap.data() as BudgetItem;
            }
        }

        if (!oldItemData) throw new Error(`Budget item with id ${id} not found.`);

        // --- All reads are done, now writes ---
        const newData = { ...oldItemData, ...itemData };
        
        if (isRecurringInstance && !itemRef.path.includes('override')) {
             const newDocData: Omit<BudgetItem, 'id'> & { originalId: string } = {
                ...(oldItemData as Omit<BudgetItem, 'id'>),
                ...itemData,
                frequency: 'One-Time',
                originalId: id,
                date: new Date(parseInt(id.split('-')[1])).toISOString(),
                completed: itemData.completed ?? false,
            };
            if (itemData.date) newDocData.date = itemData.date;
            transaction.set(itemRef, newDocData);
        } else {
             transaction.update(itemRef, itemData);
        }

        if (oldItemData.type === 'Pre-Authorized Payments') {
            const oldAmount = oldItemData.amount;
            const newAmount = itemData.amount ?? oldAmount;
            const oldCategoryId = oldItemData.budgetCategoryId;
            const newCategoryId = itemData.budgetCategoryId === undefined ? oldCategoryId : itemData.budgetCategoryId;
            const oldDescription = oldItemData.description;
            const newDescription = itemData.description || oldDescription;

            if (oldCategoryId !== newCategoryId || oldAmount !== newAmount || oldDescription !== newDescription) {
                if (oldCategoryId) await updateMonthlyBudget(transaction, oldCategoryId, {description: oldDescription, amount: oldAmount}, 'subtract');
                if (newCategoryId) await updateMonthlyBudget(transaction, newCategoryId, {description: newDescription, amount: newAmount}, 'add');
            }
        }
    });
}

export async function deleteBudgetItem(id: string): Promise<void> {
    const batch = writeBatch(db);
    
    // --- Step 1: READ all necessary data first ---
    let itemToDeleteRef;
    let itemToDelete: BudgetItem | null = null;
    let isOverride = false;
    
    const isRecurringInstance = id.includes('-');
    
    if (isRecurringInstance) {
        const overrideQuery = query(collection(db, BUDGET_COLLECTION), where('originalId', '==', id));
        const overrideSnapshot = await getDocs(overrideQuery);
        if (!overrideSnapshot.empty) {
            isOverride = true;
            itemToDeleteRef = overrideSnapshot.docs[0].ref;
            itemToDelete = { id: itemToDeleteRef.id, ...overrideSnapshot.docs[0].data() } as BudgetItem;
        } else {
            const baseId = id.split('-')[0];
            const baseItemRef = doc(db, BUDGET_COLLECTION, baseId);
            const baseItemSnap = await getDoc(baseItemRef);
            if (baseItemSnap.exists()) {
                itemToDelete = { ...baseItemSnap.data(), id: baseId } as BudgetItem;
                itemToDeleteRef = baseItemRef; // Will be used to create a "deleted" override
            }
        }
    } else {
        itemToDeleteRef = doc(db, BUDGET_COLLECTION, id);
        const itemToDeleteSnap = await getDoc(itemToDeleteRef);
        if (itemToDeleteSnap.exists()) {
            itemToDelete = { id: itemToDeleteRef.id, ...itemToDeleteSnap.data() } as BudgetItem;
        }
    }

    if (!itemToDelete) {
        console.log(`Item with id ${id} not found for deletion.`);
        return;
    }

    // --- Step 2: Prepare WRITES using a batch ---
    if (isRecurringInstance && !isOverride) {
        // This is a "virtual" instance. Create an override to mark it as deleted for this instance.
        // But for our app's logic, we'll just delete the base recurring item to avoid complexity.
        // A more robust app might create a "deleted instance" document. Let's delete the base.
        const baseId = id.split('-')[0];
        const baseRef = doc(db, BUDGET_COLLECTION, baseId);
        batch.delete(baseRef);

    } else {
        // It's a one-time item or an override, just delete it.
         batch.delete(itemToDeleteRef);
    }
    
    if (itemToDelete.type === 'Pre-Authorized Payments' && itemToDelete.budgetCategoryId) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const budgetQuery = query(collection(db, MONTHLY_BUDGET_COLLECTION), where('month', '==', currentMonth), where('categoryId', '==', itemToDelete.budgetCategoryId));
        const budgetSnapshot = await getDocs(budgetQuery);
        
        if (!budgetSnapshot.empty) {
            const budgetDoc = budgetSnapshot.docs[0];
            const budgetData = budgetDoc.data() as MonthlyBudgetItem;
            const newBreakdown = (budgetData.breakdown || []).filter(b => b.name !== itemToDelete!.description);
            const newBudgeted = newBreakdown.reduce((sum, item) => sum + item.amount, 0);
            batch.update(budgetDoc.ref, { budgeted: newBudgeted, breakdown: newBreakdown });
        }
    }

    // --- Step 3: Commit all changes ---
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

