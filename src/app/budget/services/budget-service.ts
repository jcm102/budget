
import { Firestore, collection, getDocs, doc, setDoc, deleteDoc, query, getDoc, addDoc, where, writeBatch, updateDoc, orderBy, runTransaction, limit, DocumentReference, QueryDocumentSnapshot, Transaction } from 'firebase/firestore';
import type { BudgetItem, Debt, AccountDetails, MonthlyBudgetItem, BudgetItemType, Category } from '@/types';
import { isSameMonth, startOfMonth, addWeeks, isBefore, lastDayOfMonth, addMonths, startOfDay, format, endOfMonth, parse } from 'date-fns';
import { getDebts } from '@/app/debt/services/debt-service';
import { getCategories as getBudgetCategories } from '@/services/budget-category-service';

function cleanUndefined<T>(obj: T): T {
  const newObj = { ...obj } as any;
  Object.keys(newObj).forEach(key => {
    if (newObj[key] === undefined) {
      delete newObj[key];
    }
  });
  return newObj;
}

function parseDateString(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (/^\d+$/.test(dateStr)) {
    return new Date(parseInt(dateStr, 10));
  }
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return new Date(dateStr);
}

const BUDGET_COLLECTION = 'budget-items';
const DEBT_COLLECTION = 'debts';
const MONTHLY_BUDGET_COLLECTION = 'monthly-budget-items';
const ACCOUNTS_COLLECTION = 'transferees';


export async function getBudgetItems(db: Firestore, selectedMonth: string): Promise<BudgetItem[]> {
  const budgetCollectionRef = collection(db, BUDGET_COLLECTION);
  const q = query(budgetCollectionRef, where('type', 'in', ['Income', 'Pre-Authorized Payments', 'Transfers', 'Debt Payments']));
  const querySnapshot = await getDocs(q);
  
  const allItems = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetItem));

  const startOfCurrentMonth = startOfMonth(parse(selectedMonth + '-01', 'yyyy-MM-dd', new Date()));
  const endOfNextMonth = endOfMonth(addMonths(startOfCurrentMonth, 1));
  const startOfSearch = addMonths(startOfCurrentMonth, -1);

  const generatedItems: BudgetItem[] = [];

  // Separate base items from one-time overrides
  const baseItems = allItems.filter(item => !item.originalId);
  const overrideItems = allItems.filter(item => !!item.originalId);

  // A map to track which recurring instances have been overridden
  const overriddenInstances = new Set<string>();

  // Process overrides first and populate generatedItems and the tracking set
  overrideItems.forEach(override => {
      const overrideDate = startOfDay(parseDateString(override.date));
      const budgetDate = override.forNextMonth ? addMonths(overrideDate, 1) : overrideDate;
      if (budgetDate >= startOfCurrentMonth && budgetDate <= endOfNextMonth) {
          if (!override.archived && !override.deleted) {
              generatedItems.push({
                  ...override,
                  isNextMonthView: !isSameMonth(budgetDate, startOfCurrentMonth),
              });
          }
          // Mark the original instance as overridden
          if (override.originalId) {
            overriddenInstances.add(override.originalId);
          }
      }
  });
  
  // Process base recurring and one-time items
  baseItems.forEach(item => {
    const itemStartDate = startOfDay(parseDateString(item.date));

    // Handle one-time items that are not overrides
    if (item.frequency === 'One-Time') {
        const budgetDate = item.forNextMonth ? addMonths(itemStartDate, 1) : itemStartDate;
        if (budgetDate >= startOfCurrentMonth && budgetDate <= endOfNextMonth) {
            generatedItems.push({
                ...item,
                isNextMonthView: !isSameMonth(budgetDate, startOfCurrentMonth),
            });
        }
        return; // Continue to next item
    }

    // --- Handle Recurring Items ---
    
    // Find the first occurrence of the event in the current or future months
    let effectiveDate = itemStartDate;
    if (item.frequency === 'Weekly' || item.frequency === 'Bi-Weekly') {
      const increment = item.frequency === 'Weekly' ? 1 : 2;
      while (isBefore(effectiveDate, startOfSearch)) {
        effectiveDate = addWeeks(effectiveDate, increment);
      }
    } else { // Monthly frequencies
       while (isBefore(effectiveDate, startOfSearch)) {
        effectiveDate = addMonths(effectiveDate, 1);
      }
    }

    // Generate instances from the effective date until the end of the next month
    let currentDate = effectiveDate;
    while (currentDate <= endOfNextMonth) {
        let instanceDate = currentDate;

        if (item.frequency === 'Monthly (Last Day)') {
             // Ensure it's the last day of the month for this frequency type
             instanceDate = lastDayOfMonth(currentDate);
        }

        const budgetDate = item.forNextMonth ? addMonths(instanceDate, 1) : instanceDate;

        // Only generate if the instance date is within our window
        if (budgetDate >= startOfCurrentMonth && budgetDate <= endOfNextMonth) {
            const instanceId = `${item.id}-${instanceDate.getTime()}`;

            // If this instance hasn't been overridden, add it to the list
            if (!overriddenInstances.has(instanceId)) {
                generatedItems.push({
                    ...item,
                    id: instanceId, // Use a unique ID for this specific instance
                    date: format(instanceDate, 'yyyy-MM-dd'),
                    completed: false,
                    isNextMonthView: !isSameMonth(budgetDate, startOfCurrentMonth),
                });
            }
        }

        // Move to the next potential date
        if (item.frequency === 'Weekly' || item.frequency === 'Bi-Weekly') {
            const increment = item.frequency === 'Weekly' ? 1 : 2;
            currentDate = addWeeks(currentDate, increment);
        } else {
            currentDate = addMonths(currentDate, 1);
        }
    }
  });

  return generatedItems.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function addBudgetItem(db: Firestore, itemData: Omit<BudgetItem, 'id'>): Promise<BudgetItem> {
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

    // Remove transferee queries to avoid updating balances immediately on item creation
    
    const budgetSnapshot = budgetItemQuery ? await getDocs(budgetItemQuery) : null;
    
    // --- ALL WRITES AFTER READS ---
    transaction.set(newDocRef, cleanUndefined(dataWithCompleted));

    // Handle PA Payments budget update
    if (budgetSnapshot) {
      const currentMonth = new Date().toISOString().slice(0, 7);
      let budgetItemRef: DocumentReference;
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
      transaction.set(budgetItemRef, cleanUndefined(dataToSet), { merge: true });
    }
  });

  return { id: 'refetch-to-get-id', ...dataWithCompleted };
}


async function adjustBalancesForItem(
    transaction: Transaction, 
    oldItem: BudgetItem | null, 
    newItem: BudgetItem,
    preFetchedAccountsByName: Map<string, any>,
    db: Firestore
) {
    const isOldCompleted = oldItem?.completed || false;
    const isNewCompleted = newItem.completed || false;
    
    if (oldItem?.transactionId || newItem.transactionId) return;
    if (newItem.type !== 'Income' && newItem.type !== 'Transfers') return;
    if (newItem.forNextMonth) return;

    const getAccountSnap = async (accountId: string | null | undefined, accountName: string | null | undefined) => {
        if (accountId) {
            return await transaction.get(doc(db, ACCOUNTS_COLLECTION, accountId));
        }
        if (accountName) {
            const preDoc = preFetchedAccountsByName.get(accountName);
            if (preDoc) {
                return await transaction.get(preDoc.ref);
            }
        }
        return null;
    };

    // Case 1: Toggled from incomplete to completed
    if (!isOldCompleted && isNewCompleted) {
        if (newItem.type === 'Income') {
            const destSnap = await getAccountSnap(newItem.destinationAccountId, null);
            if (destSnap?.exists()) {
                const data = destSnap.data() as any;
                const bal = data.balance || 0;
                transaction.update(destSnap.ref, { balance: bal + newItem.amount });
            }
        } else if (newItem.type === 'Transfers') {
            const [fromSnap, toSnap] = await Promise.all([
                getAccountSnap(null, newItem.transferFrom),
                getAccountSnap(null, newItem.transferTo)
            ]);
            if (fromSnap?.exists() && toSnap?.exists()) {
                const fromData = fromSnap.data() as any;
                const toData = toSnap.data() as any;
                const fromBal = fromData.balance || 0;
                const toBal = toData.balance || 0;
                transaction.update(fromSnap.ref, { balance: fromBal - newItem.amount });
                transaction.update(toSnap.ref, { balance: toBal + newItem.amount });
            }
        }
    }
    // Case 2: Toggled from completed to incomplete
    else if (isOldCompleted && !isNewCompleted && oldItem) {
        if (oldItem.type === 'Income') {
            const destSnap = await getAccountSnap(oldItem.destinationAccountId, null);
            if (destSnap?.exists()) {
                const data = destSnap.data() as any;
                const bal = data.balance || 0;
                transaction.update(destSnap.ref, { balance: bal - oldItem.amount });
            }
        } else if (oldItem.type === 'Transfers') {
            const [fromSnap, toSnap] = await Promise.all([
                getAccountSnap(null, oldItem.transferFrom),
                getAccountSnap(null, oldItem.transferTo)
            ]);
            if (fromSnap?.exists() && toSnap?.exists()) {
                const fromData = fromSnap.data() as any;
                const toData = toSnap.data() as any;
                const fromBal = fromData.balance || 0;
                const toBal = toData.balance || 0;
                transaction.update(fromSnap.ref, { balance: fromBal + oldItem.amount });
                transaction.update(toSnap.ref, { balance: toBal - oldItem.amount });
            }
        }
    }
    // Case 3: Amount or details changed while remaining completed
    else if (isOldCompleted && isNewCompleted && oldItem) {
        const amountDiff = newItem.amount - oldItem.amount;
        if (amountDiff === 0) return;
        
        if (newItem.type === 'Income') {
            const destSnap = await getAccountSnap(newItem.destinationAccountId, null);
            if (destSnap?.exists()) {
                const data = destSnap.data() as any;
                const bal = data.balance || 0;
                transaction.update(destSnap.ref, { balance: bal + amountDiff });
            }
        } else if (newItem.type === 'Transfers') {
            const [fromSnap, toSnap] = await Promise.all([
                getAccountSnap(null, newItem.transferFrom),
                getAccountSnap(null, newItem.transferTo)
            ]);
            if (fromSnap?.exists() && toSnap?.exists()) {
                const fromData = fromSnap.data() as any;
                const toData = toSnap.data() as any;
                const fromBal = fromData.balance || 0;
                const toBal = toData.balance || 0;
                transaction.update(fromSnap.ref, { balance: fromBal - amountDiff });
                transaction.update(toSnap.ref, { balance: toBal + amountDiff });
            }
        }
    }
}

export async function updateBudgetItem(db: Firestore, id: string, itemData: Partial<Omit<BudgetItem, 'id' | 'originalId'>>, updateType?: 'instance' | 'pattern'): Promise<void> {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    // --- QUERY BEFORE TRANSACTION ---
    let preFetchedOverrideSnap: any = null;
    let preFetchedBaseSnap: any = null;
    // A generated occurrence ID ends with a Unix timestamp (13+ digit number after the last dash).
    // This correctly handles base IDs that contain dashes, e.g. 'sinking-funds-transfer-1785556800000'.
    const lastDashIndex = id ? id.lastIndexOf('-') : -1;
    const suffix = lastDashIndex >= 0 ? id.slice(lastDashIndex + 1) : '';
    const isRecurringInstance = /^\d{10,}$/.test(suffix);
    const baseId = isRecurringInstance ? id.slice(0, lastDashIndex) : id;

    if (isRecurringInstance && updateType !== 'pattern') {
        const overrideQuery = query(collection(db, BUDGET_COLLECTION), where('originalId', '==', id), limit(1));
        const overrideSnapshot = await getDocs(overrideQuery);
        if (!overrideSnapshot.empty) {
            preFetchedOverrideSnap = overrideSnapshot.docs[0];
        }
        const baseItemSnap = await getDoc(doc(db, BUDGET_COLLECTION, baseId));
        if (baseItemSnap.exists()) {
            preFetchedBaseSnap = baseItemSnap;
        }
    } else {
        const baseItemSnap = await getDoc(doc(db, BUDGET_COLLECTION, id));
        if (baseItemSnap.exists()) {
            preFetchedBaseSnap = baseItemSnap;
        }
    }

    const tempOldItemData = preFetchedOverrideSnap 
        ? { ...preFetchedOverrideSnap.data(), id: preFetchedOverrideSnap.id } 
        : (preFetchedBaseSnap ? { ...preFetchedBaseSnap.data(), id: baseId } : null) as BudgetItem | null;

    const oldFrom = tempOldItemData?.transferFrom;
    const oldTo = tempOldItemData?.transferTo;
    const newFrom = itemData.transferFrom;
    const newTo = itemData.transferTo;

    const accountNames = new Set<string>();
    if (oldFrom) accountNames.add(oldFrom);
    if (oldTo) accountNames.add(oldTo);
    if (newFrom) accountNames.add(newFrom);
    if (newTo) accountNames.add(newTo);

    const preFetchedAccountsByName = new Map<string, any>();
    if (accountNames.size > 0) {
        const q = query(collection(db, ACCOUNTS_COLLECTION), where('name', 'in', Array.from(accountNames)));
        const snaps = await getDocs(q);
        snaps.forEach(doc => {
            preFetchedAccountsByName.set(doc.data().name, doc);
        });
    }

    await runTransaction(db, async (transaction) => {
        // --- ALL READS FIRST ---
        let oldItemData: BudgetItem | null = null;
        let originalItemRef: DocumentReference;
        let isOverride = false;
        
        if (isRecurringInstance && updateType === 'pattern') {
            originalItemRef = doc(db, BUDGET_COLLECTION, baseId);
            const docSnap = await transaction.get(originalItemRef);
            if (docSnap.exists()) {
                oldItemData = { id: baseId, ...docSnap.data() } as BudgetItem;
            }
            isOverride = false;
        } else if (isRecurringInstance) {
            if (preFetchedOverrideSnap) {
                originalItemRef = preFetchedOverrideSnap.ref;
                const docSnap = await transaction.get(originalItemRef);
                if (docSnap.exists()) {
                    oldItemData = { ...docSnap.data(), id: originalItemRef.id } as BudgetItem;
                }
                isOverride = true;
            } else {
                const baseItemRef = doc(db, BUDGET_COLLECTION, baseId);
                const originalItemSnap = await transaction.get(baseItemRef);
                if (originalItemSnap.exists()) {
                     oldItemData = { ...originalItemSnap.data(), id } as BudgetItem; // Use the instance ID
                }
                originalItemRef = doc(collection(db, BUDGET_COLLECTION)); // Will be a new override doc
            }
        } else {
            originalItemRef = doc(db, BUDGET_COLLECTION, id);
            const docSnap = await transaction.get(originalItemRef);
            if(docSnap.exists()) {
                oldItemData = {id, ...docSnap.data()} as BudgetItem;
            }
        }

        if (!oldItemData) throw new Error(`Budget item with id ${id} not found.`);

        const newData = { ...oldItemData, ...itemData } as BudgetItem;
        const oldCategoryId = oldItemData.type === 'Pre-Authorized Payments' ? oldItemData.budgetCategoryId : undefined;
        const newCategoryId = newData.type === 'Pre-Authorized Payments' ? newData.budgetCategoryId : undefined;

        let oldBudgetItemSnap: QueryDocumentSnapshot | undefined;
        if (oldCategoryId) {
            const q = query(collection(db, MONTHLY_BUDGET_COLLECTION), where('categoryId', '==', oldCategoryId), where('month', '==', currentMonth), limit(1));
            const snaps = await getDocs(q);
            if (!snaps.empty) oldBudgetItemSnap = snaps.docs[0];
        }
        
        let newBudgetItemSnap: QueryDocumentSnapshot | undefined;
        if (newCategoryId && newCategoryId !== oldCategoryId) {
            const q = query(collection(db, MONTHLY_BUDGET_COLLECTION), where('categoryId', '==', newCategoryId), where('month', '==', currentMonth), limit(1));
            newBudgetItemSnap = (await getDocs(q)).docs[0];
        } else if (newCategoryId) {
            newBudgetItemSnap = oldBudgetItemSnap;
        }

        // --- ALL WRITES AFTER READS ---
        
        // Revert or apply account balance changes reactively based on completed checkbox state
        await adjustBalancesForItem(transaction, oldItemData, newData, preFetchedAccountsByName, db);

        if (isRecurringInstance && !isOverride && updateType !== 'pattern') {
            const instanceTimestamp = id.slice(id.lastIndexOf('-') + 1);
            const newDocData: Omit<BudgetItem, 'id'> & { originalId: string } = {
                ...(oldItemData as Omit<BudgetItem, 'id'>),
                ...itemData,
                frequency: 'One-Time',
                originalId: id,
                date: format(new Date(parseInt(instanceTimestamp)), 'yyyy-MM-dd'),
                completed: itemData.completed ?? oldItemData!.completed,
            };
            if (itemData.date) newDocData.date = itemData.date;
            transaction.set(originalItemRef, cleanUndefined(newDocData));
        } else {
             transaction.update(originalItemRef, cleanUndefined(itemData));
        }
        
        if (oldCategoryId && oldBudgetItemSnap?.exists()) {
            const budgetData = oldBudgetItemSnap.data() as MonthlyBudgetItem;
            const filteredBreakdown = budgetData.breakdown?.filter(item => item.name !== oldItemData!.description) || [];
            const newBudgeted = filteredBreakdown.reduce((sum, item) => sum + item.amount, 0);
            transaction.update(oldBudgetItemSnap.ref, { budgeted: newBudgeted, breakdown: filteredBreakdown });
        }

        if (newCategoryId) {
            let budgetItemRef: DocumentReference;
            let currentBreakdown: any[] = [];
            if(newBudgetItemSnap?.exists()) {
                budgetItemRef = newBudgetItemSnap.ref;
                currentBreakdown = (newBudgetItemSnap.data() as MonthlyBudgetItem).breakdown?.filter(item => item.name !== oldItemData!.description) || [];
            } else {
                budgetItemRef = doc(collection(db, MONTHLY_BUDGET_COLLECTION));
            }

            const finalBreakdown = [...currentBreakdown, { name: newData.description, amount: newData.amount }];
            const finalBudgeted = finalBreakdown.reduce((sum, item) => sum + item.amount, 0);
            transaction.set(budgetItemRef, cleanUndefined({ categoryId: newCategoryId, month: currentMonth, budgeted: finalBudgeted, breakdown: finalBreakdown }), { merge: true });
        }
    });
}

export async function deleteBudgetItem(db: Firestore, id: string, deleteType?: 'instance' | 'pattern'): Promise<void> {
    const batch = writeBatch(db);
    
    // --- Step 1: READ all necessary data first ---
    let itemToDeleteRef: DocumentReference | undefined;
    let itemToDelete: BudgetItem | null = null;
    let isOverride = false;
    
    const lastDashIdx = id ? id.lastIndexOf('-') : -1;
    const idSuffix = lastDashIdx >= 0 ? id.slice(lastDashIdx + 1) : '';
    const isRecurringInstance = /^\d{10,}$/.test(idSuffix);
    const baseId = isRecurringInstance ? id.slice(0, lastDashIdx) : id;
    
    if (isRecurringInstance) {
        const overrideQuery = query(collection(db, BUDGET_COLLECTION), where('originalId', '==', id), limit(1));
        const overrideSnapshot = await getDocs(overrideQuery);
        if (!overrideSnapshot.empty) {
            isOverride = true;
            itemToDeleteRef = overrideSnapshot.docs[0].ref;
            itemToDelete = { id: itemToDeleteRef.id, ...overrideSnapshot.docs[0].data() } as BudgetItem;
        } else {
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
    if (isRecurringInstance && deleteType === 'instance') {
        const baseId = id.split('-')[0];
        const timestamp = parseInt(id.split('-')[1], 10);
        const instanceDate = new Date(timestamp);
        
        const baseItemRef = doc(db, BUDGET_COLLECTION, baseId);
        const baseItemSnap = await getDoc(baseItemRef);
        const baseItemData = baseItemSnap.exists() ? baseItemSnap.data() : {};

        const overrideData = {
            ...baseItemData,
            originalId: id,
            date: format(instanceDate, 'yyyy-MM-dd'),
            archived: true,
        };
        delete (overrideData as any).id;
        
        const newOverrideRef = doc(collection(db, BUDGET_COLLECTION));
        batch.set(newOverrideRef, overrideData);
    } else if (isRecurringInstance && (!deleteType || deleteType === 'pattern') && !isOverride) {
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
    
    if (itemToDelete.completed && !itemToDelete.forNextMonth) {
        if (itemToDelete.type === 'Income' && itemToDelete.destinationAccountId) {
            const accountRef = doc(db, ACCOUNTS_COLLECTION, itemToDelete.destinationAccountId);
            const accountSnap = await getDoc(accountRef);
            if (accountSnap.exists()) {
                const currentBalance = accountSnap.data().balance || 0;
                batch.update(accountRef, { balance: currentBalance - itemToDelete.amount });
            }
        } else if (itemToDelete.type === 'Transfers' && itemToDelete.transferFrom && itemToDelete.transferTo) {
            const fromQuery = query(collection(db, ACCOUNTS_COLLECTION), where('name', '==', itemToDelete.transferFrom), limit(1));
            const toQuery = query(collection(db, ACCOUNTS_COLLECTION), where('name', '==', itemToDelete.transferTo), limit(1));
            const [fromSnap, toSnap] = await Promise.all([getDocs(fromQuery), getDocs(toQuery)]);
            if (!fromSnap.empty && !toSnap.empty) {
                const fromRef = fromSnap.docs[0].ref;
                const toRef = toSnap.docs[0].ref;
                const [fromDoc, toDoc] = await Promise.all([getDoc(fromRef), getDoc(toRef)]);
                const fromBal = fromDoc.data()?.balance || 0;
                const toBal = toDoc.data()?.balance || 0;
                batch.update(fromRef, { balance: fromBal + itemToDelete.amount });
                batch.update(toRef, { balance: toBal - itemToDelete.amount });
            }
        }
    }

    // --- Step 3: Commit all changes ---
    await batch.commit();
}


export async function cycleBudgetItems(db: Firestore, itemType: BudgetItemType): Promise<void> {
  const batch = writeBatch(db);
  const q = query(
    collection(db, BUDGET_COLLECTION), 
    where('type', '==', itemType),
  );
  
  const snapshot = await getDocs(q);
  
  snapshot.forEach(doc => {
      batch.update(doc.ref, { completed: false });
  });

  await batch.commit();
}
  
export async function syncDebtPaymentsFromWorksheet(db: Firestore, forNextMonth: boolean): Promise<void> {
    const targetMonth = forNextMonth 
      ? format(addMonths(new Date(), 1), 'yyyy-MM')
      : format(new Date(), 'yyyy-MM');

    // 1. Fetch worksheet debts for the target month first (outside transaction)
    const baseDebtsSnapshot = await getDocs(query(collection(db, DEBT_COLLECTION), orderBy('order')));
    const debtPromises = baseDebtsSnapshot.docs.map(async (docSnap) => {
        const baseData = docSnap.data();
        const monthlyRef = doc(db, DEBT_COLLECTION, docSnap.id, 'months', targetMonth);
        const monthlySnap = await getDoc(monthlyRef);
        let monthlyData = {};
        if (monthlySnap.exists()) {
            monthlyData = monthlySnap.data() || {};
        }
        return {
            id: docSnap.id,
            ...baseData,
            ...monthlyData
        } as Debt;
    });
    const allDebts = await Promise.all(debtPromises);

    // 2. Fetch existing budget items to clear
    const clearQuery = query(
        collection(db, BUDGET_COLLECTION),
        where('type', '==', 'Debt Payments'),
        where('forNextMonth', '==', forNextMonth)
    );
    const clearSnapshot = await getDocs(clearQuery);

    await runTransaction(db, async (transaction) => {
        // Delete old payments
        clearSnapshot.forEach(doc => {
            transaction.delete(doc.ref);
        });

        // Create new payments
        for (const debt of allDebts) {
            // Archived debts are not synced if their balance is 0
            if (debt.archived && (debt.balance || 0) <= 0) continue;
            
            const amount = forNextMonth ? debt.minimumPayment : debt.plannedPayment;
            if (amount && amount > 0) {
                const newItem: Omit<BudgetItem, 'id'> = {
                    type: 'Debt Payments',
                    category: 'N/A',
                    description: debt.name,
                    amount: amount,
                    date: debt.dueDate || `${targetMonth}-01`,
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
        await syncDebtPaymentsToMonthlyBudget(db);
    }
}


export async function syncDebtPaymentsToMonthlyBudget(db: Firestore): Promise<void> {
    const nextMonth = format(addMonths(new Date(), 1), 'yyyy-MM');

    // 1. Fetch base debts and monthly subcollection for next month
    const baseDebtsSnapshot = await getDocs(query(collection(db, DEBT_COLLECTION), orderBy('order')));
    const debtPromises = baseDebtsSnapshot.docs.map(async (docSnap) => {
        const baseData = docSnap.data();
        const monthlyRef = doc(db, DEBT_COLLECTION, docSnap.id, 'months', nextMonth);
        const monthlySnap = await getDoc(monthlyRef);
        let monthlyData = {};
        if (monthlySnap.exists()) {
            monthlyData = monthlySnap.data() || {};
        }
        return {
            id: docSnap.id,
            ...baseData,
            ...monthlyData
        } as Debt;
    });
    const debts = await Promise.all(debtPromises);

    // 2. Fetch categories
    const categoriesSnapshot = await getDocs(collection(db, 'budget-categories'));
    const budgetCategories = categoriesSnapshot.docs
      .filter(doc => doc.id !== '_seeded')
      .map(doc => ({ id: doc.id, ...doc.data() } as Category));
      
    await runTransaction(db, async (transaction) => {
        const categoryMap = new Map<string, string>();
        budgetCategories.forEach(cat => categoryMap.set(cat.name, cat.id));

        const categoryAggregates: Record<string, { total: number; breakdown: { name: string; amount: number }[] }> = {};

        // Aggregate payments by category
        for (const debt of debts) {
            if (debt.archived && (debt.balance || 0) <= 0) continue;
            
            const amount = debt.minimumPayment || 0;
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

        // Update or create monthly budget items inside transaction
        for (const categoryId in categoryAggregates) {
            const { total, breakdown } = categoryAggregates[categoryId];
            
            const budgetItemQuery = query(
                collection(db, MONTHLY_BUDGET_COLLECTION),
                where('month', '==', nextMonth),
                where('categoryId', '==', categoryId),
                limit(1)
            );
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
