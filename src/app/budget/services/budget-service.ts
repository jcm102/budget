
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
import { isSameMonth, startOfMonth, addWeeks, isBefore, lastDayOfMonth, addMonths, startOfDay, format, endOfMonth } from 'date-fns';
import { getDebts } from '@/app/debt/services/debt-service';
import { getCategories as getBudgetCategories } from '@/services/budget-category-service';

const BUDGET_COLLECTION = 'budget-items';
const DEBT_COLLECTION = 'debts';
const MONTHLY_BUDGET_COLLECTION = 'monthly-budget-items';
const ACCOUNTS_COLLECTION = 'transferees';


export async function getBudgetItems(): Promise<BudgetItem[]> {
  const budgetCollection = collection(db, BUDGET_COLLECTION);
  const q = query(budgetCollection, where('type', 'in', ['Income', 'Pre-Authorized Payments', 'Transfers', 'Debt Payments']));
  const querySnapshot = await getDocs(q);
  
  const today = new Date();
  const allGeneratedItems: BudgetItem[] = [];
  const startOfCurrentMonth = startOfMonth(today);
  const startOfNextMonth = startOfMonth(addMonths(today, 1));
  const endOfNextMonth = endOfMonth(startOfNextMonth);
  
  const allItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetItem));

  // Find all modified one-time items (overrides)
  const modifiedItems = allItems.filter(item => item.originalId);
  const processedRecurringInstances = new Set<string>();

  modifiedItems.forEach(item => {
    const itemDate = new Date(item.date);
    if (isSameMonth(itemDate, today) || isSameMonth(itemDate, startOfNextMonth)) {
        allGeneratedItems.push({
            ...item,
            forNextMonth: isSameMonth(itemDate, startOfNextMonth),
        });
        if (item.originalId) {
            processedRecurringInstances.add(item.originalId);
        }
    }
  });


  allItems.forEach(item => {
    if (item.originalId) return; // Skip overrides, they're already processed

    if (item.frequency === 'One-Time') {
        const itemDate = new Date(item.date);
        if (isSameMonth(itemDate, today) || isSameMonth(itemDate, startOfNextMonth)) {
            allGeneratedItems.push({
                ...item,
                forNextMonth: isSameMonth(itemDate, startOfNextMonth),
            });
        }
    } else {
        let currentDate = startOfDay(new Date(item.date));
        
        const advanceDate = () => {
             switch (item.frequency) {
                case 'Weekly':
                    currentDate = addWeeks(currentDate, 1);
                    break;
                case 'Bi-Weekly':
                    currentDate = addWeeks(currentDate, 2);
                    break;
                case 'Monthly (Last Day)':
                    currentDate = lastDayOfMonth(addMonths(currentDate, 1));
                    break;
                case 'Monthly':
                    currentDate = addMonths(currentDate, 1);
                    break;
            }
        };

        // Fast-forward to the current period if the start date is in the past
        while (isBefore(currentDate, startOfCurrentMonth)) {
            advanceDate();
        }

        // Generate instances until we are past the next month
        while (isBefore(currentDate, endOfNextMonth) || isSameMonth(currentDate, endOfNextMonth)) {
            const isCurrent = isSameMonth(currentDate, today);
            const isNext = isSameMonth(currentDate, startOfNextMonth);

            if (isCurrent || isNext) {
                 const instanceId = `${item.id}-${currentDate.getTime()}`;
                if (!processedRecurringInstances.has(instanceId)) {
                    allGeneratedItems.push({
                        ...item,
                        id: instanceId, 
                        date: currentDate.toISOString(),
                        completed: item.completed || false,
                        forNextMonth: isNext,
                    });
                }
            }
            advanceDate();
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
    let budgetItemQuery, fromAccountQuery, toAccountQuery, destAccountQuery;
    
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

    if (itemData.type === 'Income' && itemData.destinationAccountId) {
        destAccountQuery = doc(db, ACCOUNTS_COLLECTION, itemData.destinationAccountId);
    }
    
    const budgetSnapshot = budgetItemQuery ? await getDocs(budgetItemQuery) : null;
    const fromAccountSnapshot = fromAccountQuery ? await getDocs(fromAccountQuery) : null;
    const toAccountSnapshot = toAccountQuery ? await getDocs(toAccountQuery) : null;
    const destAccountSnap = destAccountQuery ? await transaction.get(destAccountQuery) : null;
    
    // --- ALL WRITES AFTER READS ---
    transaction.set(newDocRef, dataWithCompleted);
    
    if (itemData.type === 'Income' && destAccountSnap?.exists() && !itemData.forNextMonth) {
        const currentBalance = destAccountSnap.data().balance || 0;
        transaction.update(destAccountSnap.ref, { balance: currentBalance + itemData.amount });
    }

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
        
        const isRecurringInstance = id && id.includes('-');
        if (isRecurringInstance) {
            const baseId = id.split('-')[0];
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

        let oldDestAccountSnap, newDestAccountSnap;
        if (oldItemData.type === 'Income' && oldItemData.destinationAccountId && !oldItemData.forNextMonth) {
            oldDestAccountSnap = await getDoc(doc(db, ACCOUNTS_COLLECTION, oldItemData.destinationAccountId));
        }
        if (newData.type === 'Income' && newData.destinationAccountId && !newData.forNextMonth) {
             newDestAccountSnap = await getDoc(doc(db, ACCOUNTS_COLLECTION, newData.destinationAccountId));
        }

        // --- ALL WRITES AFTER READS ---
        
        // Revert old transaction if necessary
        if(oldDestAccountSnap?.exists()) {
            const currentBalance = oldDestAccountSnap.data().balance || 0;
            transaction.update(oldDestAccountSnap.ref, { balance: currentBalance - oldItemData.amount });
        }
        
        // Apply new transaction
        if(newDestAccountSnap?.exists()) {
             const currentBalance = newDestAccountSnap.data().balance || 0;
            transaction.update(newDestAccountSnap.ref, { balance: currentBalance + newData.amount });
        }


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
    
    const isRecurringInstance = id && id.includes('-');
    
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
        const baseId = id.split('-')[0];
        const baseRef = doc(db, BUDGET_COLLECTION, baseId);
        batch.delete(baseRef);
    } else if (itemToDeleteRef) {
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
    
    if (itemToDelete.type === 'Income' && itemToDelete.destinationAccountId && !itemToDelete.forNextMonth) {
        const accountRef = doc(db, ACCOUNTS_COLLECTION, itemToDelete.destinationAccountId);
        const accountSnap = await getDoc(accountRef);
        if (accountSnap.exists()) {
            const currentBalance = accountSnap.data().balance || 0;
            batch.update(accountRef, { balance: currentBalance - itemToDelete.amount });
        }
    }

    // --- Step 3: Commit all changes ---
    await batch.commit();
}


export async function cycleBudgetItems(): Promise<void> {
  const batch = writeBatch(db);
  
  // Query for items that are for the current month (or have no forNextMonth flag, for backward compatibility)
  const currentMonthQuery = query(collection(db, BUDGET_COLLECTION), where('forNextMonth', '!=', true));
  const currentMonthSnapshot = await getDocs(currentMonthQuery);
  currentMonthSnapshot.forEach(doc => {
      batch.delete(doc.ref);
  });
  
  // Query for items planned for next month
  const nextMonthQuery = query(collection(db, BUDGET_COLLECTION), where('forNextMonth', '==', true));
  const nextMonthSnapshot = await getDocs(nextMonthQuery);
  nextMonthSnapshot.forEach(doc => {
      // Update them to be for the current month now
      batch.update(doc.ref, { forNextMonth: false, completed: false });
  });

  await batch.commit();
}
  
export async function syncDebtPaymentsFromWorksheet(forNextMonth: boolean): Promise<void> {
    await runTransaction(db, async (transaction) => {
        // 1. Fetch existing debt payments for the target month
        const clearQuery = query(
            collection(db, BUDGET_COLLECTION),
            where('type', '==', 'Debt Payments'),
            where('forNextMonth', '==', forNextMonth)
        );
        const clearSnapshot = await getDocs(clearQuery);

        // 2. Fetch all debts from the worksheet
        const debtCollection = collection(db, DEBT_COLLECTION);
        const debtsSnapshot = await getDocs(query(debtCollection, orderBy('order')));
        const allDebts = debtsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Debt));

        // 3. Delete old payments
        clearSnapshot.forEach(doc => {
            transaction.delete(doc.ref);
        });

        // 4. Create new payments
        for (const debt of allDebts) {
            const amount = forNextMonth ? debt.nextMinimumPayment : debt.plannedPayment;
            if (amount && amount > 0) {
                const newItem: Omit<BudgetItem, 'id'> = {
                    type: 'Debt Payments',
                    category: 'N/A',
                    description: debt.name,
                    amount: amount,
                    date: forNextMonth ? debt.nextDueDate || new Date().toISOString() : debt.dueDate,
                    frequency: 'One-Time',
                    completed: false,
                    forNextMonth: forNextMonth,
                };
                const newDocRef = doc(collection(db, BUDGET_COLLECTION));
                transaction.set(newDocRef, newItem);
            }
        }
    });

    if (forNextMonth) {
        await syncDebtPaymentsToMonthlyBudget();
    }
}


export async function syncDebtPaymentsToMonthlyBudget(): Promise<void> {
    // 1. Fetch all necessary data outside the transaction
    const [debts, budgetCategories] = await Promise.all([
        getDebts(),
        getBudgetCategories()
    ]);
    
    await runTransaction(db, async (transaction) => {
        const nextMonth = format(addMonths(new Date(), 1), 'yyyy-MM');

        const categoryMap = new Map<string, string>();
        budgetCategories.forEach(cat => categoryMap.set(cat.name, cat.id));

        const categoryAggregates: Record<string, { total: number; breakdown: { name: string; amount: number }[] }> = {};

        // 2. Aggregate payments by category (using data fetched outside)
        for (const debt of debts) {
            const amount = debt.nextMinimumPayment || 0;
            if (amount <= 0 || !debt.debtType) continue;

            const categoryName: string | undefined = {
                'Credit Card': 'Credit Cards',
                'Loan': 'Loans',
                'Line of Credit': 'Line of Credit'
            }[debt.debtType];

            const categoryId = categoryName ? categoryMap.get(categoryName) : undefined;
            if (!categoryId) continue;

            if (!categoryAggregates[categoryId]) {
                categoryAggregates[categoryId] = { total: 0, breakdown: [] };
            }
            categoryAggregates[categoryId].total += amount;
            categoryAggregates[categoryId].breakdown.push({ name: debt.name, amount });
        }

        // 3. Update or create monthly budget items inside the transaction
        for (const categoryId in categoryAggregates) {
            const { total, breakdown } = categoryAggregates[categoryId];
            
            const budgetItemQuery = query(
                collection(db, MONTHLY_BUDGET_COLLECTION),
                where('month', '==', nextMonth),
                where('categoryId', '==', categoryId),
                limit(1)
            );
            // This read must be inside the transaction
            const snapshot = await getDocs(budgetItemQuery);
            
            const data = {
                categoryId: categoryId,
                month: nextMonth,
                budgeted: total,
                breakdown: breakdown,
            };

            if (snapshot.empty) {
                const newDocRef = doc(collection(db, MONTHLY_BUDGET_COLLECTION));
                transaction.set(newDocRef, data);
            } else {
                const docRef = snapshot.docs[0].ref;
                transaction.set(docRef, data);
            }
        }
    });
}

