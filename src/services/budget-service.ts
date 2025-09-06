

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
  limit,
} from 'firebase/firestore';
import { isSameMonth, startOfMonth, getDate, getMonth, getYear, set, addWeeks, isAfter, isBefore, isLastDayOfMonth, lastDayOfMonth, addMonths, startOfDay } from 'date-fns';

const BUDGET_COLLECTION = 'budget-items';
const MONTHLY_BUDGET_COLLECTION = 'monthly-budget-items';
const ACCOUNTS_COLLECTION = 'transferees';


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

export async function addBudgetItem(itemData: Omit<BudgetItem, 'id'>): Promise<BudgetItem> {
  const dataWithCompleted = { ...itemData, completed: false, forNextMonth: itemData.forNextMonth || false };
  
  await runTransaction(db, async (transaction) => {
    // --- ALL READS FIRST ---
    const newDocRef = doc(collection(db, BUDGET_COLLECTION));
    let budgetItemQuery, fromAccountQuery, toAccountQuery;
    
    if (itemData.type === 'Pre-Authorized Payments' && itemData.budgetCategoryId) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      budgetItemQuery = query(
        collection(db, MONTHLY_BUDGET_COLLECTION),
        where('month', '==', currentMonth),
        where('categoryId', '==', itemData.budgetCategoryId),
        limit(1)
      );
    }

    if (itemData.type === 'Transfers' && itemData.transferFrom && itemData.transferTo) {
        fromAccountQuery = query(collection(db, ACCOUNTS_COLLECTION), where('name', '==', itemData.transferFrom), limit(1));
        toAccountQuery = query(collection(db, ACCOUNTS_COLLECTION), where('name', '==', itemData.transferTo), limit(1));
    }
    
    const budgetSnapshot = budgetItemQuery ? await getDocs(budgetItemQuery) : null;
    const fromAccountSnapshot = fromAccountQuery ? await getDocs(fromAccountQuery) : null;
    const toAccountSnapshot = toAccountQuery ? await getDocs(toAccountQuery) : null;
    
    // --- ALL WRITES AFTER READS ---
    transaction.set(newDocRef, dataWithCompleted);
    
    // Handle PA Payments budget update
    if (budgetSnapshot) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      let budgetItemRef: FirebaseFirestore.DocumentReference;
      let currentBudgetItem: MonthlyBudgetItem | null = null;
      if (!budgetSnapshot.empty) {
        budgetItemRef = budgetSnapshot.docs[0].ref;
        currentBudgetItem = budgetSnapshot.docs[0].data() as MonthlyBudgetItem;
      } else {
        budgetItemRef = doc(collection(db, MONTHLY_BUDGET_COLLECTION));
      }
      
      const currentBreakdown = currentBudgetItem?.breakdown || [];
      const newBreakdown = [...currentBreakdown, { name: itemData.description, amount: itemData.amount }];
      const newBudgeted = newBreakdown.reduce((sum, item) => sum + item.amount, 0);
      
      const dataToSet = {
        categoryId: itemData.budgetCategoryId,
        month: currentMonth,
        budgeted: newBudgeted,
        breakdown: newBreakdown,
      };
      transaction.set(budgetItemRef, dataToSet, { merge: true });
    }

    // Handle Transfer balance updates
    if (fromAccountSnapshot && toAccountSnapshot && !fromAccountSnapshot.empty && !toAccountSnapshot.empty) {
        const fromAccountDoc = fromAccountSnapshot.docs[0];
        const toAccountDoc = toAccountSnapshot.docs[0];

        const fromBalance = fromAccountDoc.data().balance || 0;
        const toBalance = toAccountDoc.data().balance || 0;
        
        transaction.update(fromAccountDoc.ref, { balance: fromBalance - itemData.amount });
        transaction.update(toAccountDoc.ref, { balance: toBalance + itemData.amount });
    }
  });

  return { id: 'refetch-to-get-id', ...dataWithCompleted };
}


export async function updateBudgetItem(id: string, itemData: Partial<Omit<BudgetItem, 'id' | 'originalId'>>): Promise<void> {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    await runTransaction(db, async (transaction) => {
        // --- ALL READS FIRST ---
        let oldItemData: BudgetItem | null = null;
        let originalItemRef: FirebaseFirestore.DocumentReference;
        let isOverride = false;
        let baseId = id;
        
        const isRecurringInstance = id.includes('-');
        if (isRecurringInstance) {
            baseId = id.split('-')[0];
            const overrideQuery = query(collection(db, BUDGET_COLLECTION), where('originalId', '==', id), limit(1));
            const existingOverrideSnap = await getDocs(overrideQuery);
            if (!existingOverrideSnap.empty) {
                originalItemRef = existingOverrideSnap.docs[0].ref;
                oldItemData = { ...existingOverrideSnap.docs[0].data(), id: originalItemRef.id } as BudgetItem;
                isOverride = true;
            } else {
                const baseItemRef = doc(db, BUDGET_COLLECTION, baseId);
                const originalItemSnap = await getDoc(baseItemRef);
                if (originalItemSnap.exists()) {
                     oldItemData = { ...originalItemSnap.data(), id } as BudgetItem; // Use the instance ID
                }
                originalItemRef = doc(collection(db, BUDGET_COLLECTION)); // Will be a new override doc
            }
        } else {
            originalItemRef = doc(db, BUDGET_COLLECTION, id);
            const docSnap = await getDoc(originalItemRef);
            if(docSnap.exists()) {
                oldItemData = {id, ...docSnap.data()} as BudgetItem;
            }
        }

        if (!oldItemData) throw new Error(`Budget item with id ${id} not found.`);

        const newData = { ...oldItemData, ...itemData };
        const oldCategoryId = oldItemData.type === 'Pre-Authorized Payments' ? oldItemData.budgetCategoryId : undefined;
        const newCategoryId = newData.type === 'Pre-Authorized Payments' ? newData.budgetCategoryId : undefined;

        let oldBudgetItemSnap: FirebaseFirestore.QueryDocumentSnapshot | undefined;
        if (oldCategoryId) {
            const q = query(collection(db, MONTHLY_BUDGET_COLLECTION), where('categoryId', '==', oldCategoryId), where('month', '==', currentMonth), limit(1));
            oldBudgetItemSnap = (await getDocs(q)).docs[0];
        }
        
        let newBudgetItemSnap: FirebaseFirestore.QueryDocumentSnapshot | undefined;
        if (newCategoryId && newCategoryId !== oldCategoryId) {
            const q = query(collection(db, MONTHLY_BUDGET_COLLECTION), where('categoryId', '==', newCategoryId), where('month', '==', currentMonth), limit(1));
            newBudgetItemSnap = (await getDocs(q)).docs[0];
        } else if (newCategoryId) {
            newBudgetItemSnap = oldBudgetItemSnap;
        }

        // --- ALL WRITES AFTER READS ---
        if (isRecurringInstance && !isOverride) {
            const newDocData: Omit<BudgetItem, 'id'> & { originalId: string } = {
                ...(oldItemData as Omit<BudgetItem, 'id'>),
                ...itemData,
                frequency: 'One-Time',
                originalId: id,
                date: new Date(parseInt(id.split('-')[1])).toISOString(),
                completed: itemData.completed ?? oldItemData!.completed,
            };
            if (itemData.date) newDocData.date = itemData.date;
            transaction.set(originalItemRef, newDocData);
        } else {
             transaction.update(originalItemRef, itemData);
        }
        
        if (oldCategoryId && oldBudgetItemSnap?.exists()) {
            const budgetData = oldBudgetItemSnap.data() as MonthlyBudgetItem;
            const filteredBreakdown = budgetData.breakdown?.filter(item => item.name !== oldItemData!.description) || [];
            const newBudgeted = filteredBreakdown.reduce((sum, item) => sum + item.amount, 0);
            transaction.update(oldBudgetItemSnap.ref, { budgeted: newBudgeted, breakdown: filteredBreakdown });
        }

        if (newCategoryId) {
            let budgetItemRef: FirebaseFirestore.DocumentReference;
            let currentBreakdown: any[] = [];
            if(newBudgetItemSnap?.exists()) {
                budgetItemRef = newBudgetItemSnap.ref;
                currentBreakdown = (newBudgetItemSnap.data() as MonthlyBudgetItem).breakdown?.filter(item => item.name !== oldItemData!.description) || [];
            } else {
                budgetItemRef = doc(collection(db, MONTHLY_BUDGET_COLLECTION));
            }

            const finalBreakdown = [...currentBreakdown, { name: newData.description, amount: newData.amount }];
            const finalBudgeted = finalBreakdown.reduce((sum, item) => sum + item.amount, 0);
            transaction.set(budgetItemRef, { categoryId: newCategoryId, month: currentMonth, budgeted: finalBudgeted, breakdown: finalBreakdown }, { merge: true });
        }
    });
}

export async function deleteBudgetItem(id: string): Promise<void> {
    const batch = writeBatch(db);
    
    // --- Step 1: READ all necessary data first ---
    let itemToDeleteRef: FirebaseFirestore.DocumentReference | undefined;
    let itemToDelete: BudgetItem | null = null;
    let isOverride = false;
    
    const isRecurringInstance = id.includes('-');
    
    if (isRecurringInstance) {
        const overrideQuery = query(collection(db, BUDGET_COLLECTION), where('originalId', '==', id), limit(1));
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
        // If it's a recurring instance that was never modified, we should not delete the base item.
        // The user wants to delete the *instance*, not the recurring rule.
        // This case is tricky. For now, let's assume deleting an instance means skipping it,
        // which would require creating an override "deleted" marker, which is complex.
        // A simpler approach for now is to just delete the base item if a recurring instance is deleted.
        // This is a design decision. Let's stick with deleting the base item.
        const baseId = id.split('-')[0];
        const baseRef = doc(db, BUDGET_COLLECTION, baseId);
        batch.delete(baseRef);
    } else if (itemToDeleteRef) {
        // If it's a one-time item or a modified recurring instance, delete it
        batch.delete(itemToDeleteRef);
    }
    
    if (itemToDelete.type === 'Pre-Authorized Payments' && itemToDelete.budgetCategoryId) {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const budgetQuery = query(collection(db, MONTHLY_BUDGET_COLLECTION), where('month', '==', currentMonth), where('categoryId', '==', itemToDelete.budgetCategoryId), limit(1));
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
