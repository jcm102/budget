
'use server';

import { db } from '@/lib/firebase';
import type { AutoShipItem, AutoShipFrequency, MonthlyBudgetItem } from '@/types';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  updateDoc,
  addDoc,
  getDoc,
  orderBy,
  where,
  runTransaction,
} from 'firebase/firestore';
import { addMonths } from 'date-fns';

const AUTOSHIP_COLLECTION = 'autoship-items';
const SINKING_FUNDS_COLLECTION = 'sinking-funds';
const MONTHLY_BUDGET_ITEMS_COLLECTION = 'monthly-budget-items';

const frequencyMap: Record<AutoShipFrequency, number> = {
    'Monthly': 1,
    'Every 2 Months': 2,
    'Every 3 Months': 3,
    'Every 4 Months': 4,
    'Every 6 Months': 6,
};

const getMonthlyCost = (item: Pick<AutoShipItem, 'estimatedCost' | 'frequency'>) => {
    const months = frequencyMap[item.frequency];
    return item.estimatedCost / months;
};

async function updateLinkedSinkingFund(
    transaction: FirebaseFirestore.Transaction,
    sinkingFundSnapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>,
    autoShipItem: AutoShipItem,
    oldAutoShipData?: AutoShipItem
) {
    const monthlyCost = getMonthlyCost(autoShipItem);
    
    const fundData = {
        name: autoShipItem.item,
        amount: 0,
        goal: monthlyCost,
        totalCost: autoShipItem.estimatedCost,
        dueDate: autoShipItem.nextShipmentDate,
        accountId: autoShipItem.accountId,
        currency: 'CAD', // Assuming CAD for now
        type: 'Auto-Shipment',
    };

    if (sinkingFundSnapshot.empty) {
        if (!oldAutoShipData) { // Only create if it's a new item
             const newFundRef = doc(collection(db, SINKING_FUNDS_COLLECTION));
             transaction.set(newFundRef, fundData);
        }
    } else {
        const fundDoc = sinkingFundSnapshot.docs[0];
        transaction.update(fundDoc.ref, fundData);
    }
}

async function updateMonthlyBudget(
    transaction: FirebaseFirestore.Transaction,
    budgetItemsQuery: FirebaseFirestore.Query,
    oldBudgetItemsQuery: FirebaseFirestore.Query | null,
    autoShipItem: AutoShipItem,
    oldAutoShipData?: AutoShipItem
) {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const newMonthlyCost = getMonthlyCost(autoShipItem);
    
    const [budgetItemsSnapshot, oldBudgetItemsSnapshot] = await Promise.all([
        getDocs(budgetItemsQuery),
        oldBudgetItemsQuery ? getDocs(oldBudgetItemsQuery) : Promise.resolve(null),
    ]);

    // Remove from old category if it exists and has changed
    if (oldBudgetItemsSnapshot && !oldBudgetItemsSnapshot.empty) {
        const budgetDoc = oldBudgetItemsSnapshot.docs[0];
        const budgetData = budgetDoc.data() as MonthlyBudgetItem;
        const newBreakdown = budgetData.breakdown?.filter(b => b.name !== oldAutoShipData!.item) || [];
        const newBudgeted = newBreakdown.reduce((sum, item) => sum + item.amount, 0);
        transaction.update(budgetDoc.ref, { breakdown: newBreakdown, budgeted: newBudgeted });
    }

    // Add to new category if it exists
    if (autoShipItem.budgetCategoryId) {
        if (budgetItemsSnapshot.empty) {
            const newBudgetItemRef = doc(collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION));
            transaction.set(newBudgetItemRef, {
                categoryId: autoShipItem.budgetCategoryId,
                month: currentMonth,
                budgeted: newMonthlyCost,
                breakdown: [{ name: autoShipItem.item, amount: newMonthlyCost }],
            });
        } else {
            const budgetDoc = budgetItemsSnapshot.docs[0];
            const budgetData = budgetDoc.data() as MonthlyBudgetItem;
            const existingBreakdown = budgetData.breakdown?.filter(b => b.name !== autoShipItem.item) || [];
            const newBreakdown = [...existingBreakdown, { name: autoShipItem.item, amount: newMonthlyCost }];
            const newBudgeted = newBreakdown.reduce((sum, item) => sum + item.amount, 0);
            transaction.update(budgetDoc.ref, { breakdown: newBreakdown, budgeted: newBudgeted });
        }
    }
}


export async function getAutoShipItems(accountId: string): Promise<AutoShipItem[]> {
  const autoShipCollection = collection(db, AUTOSHIP_COLLECTION);
  const q = query(autoShipCollection, where('accountId', '==', accountId));
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AutoShipItem));
  return items.sort((a, b) => new Date(a.nextShipmentDate).getTime() - new Date(b.nextShipmentDate).getTime());
}

export async function addAutoShipItem(itemData: Omit<AutoShipItem, 'id'>): Promise<AutoShipItem> {
  const docRef = await runTransaction(db, async (transaction) => {
        const newItemRef = doc(collection(db, AUTOSHIP_COLLECTION));
        const newItem = { id: newItemRef.id, ...itemData };

        const sinkingFundQuery = query(collection(db, SINKING_FUNDS_COLLECTION), where('name', '==', newItem.item), where('accountId', '==', newItem.accountId));
        
        let budgetItemsQuery = null;
        if (newItem.budgetCategoryId) {
             const currentMonth = new Date().toISOString().slice(0, 7);
             budgetItemsQuery = query(
                collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION),
                where('month', '==', currentMonth),
                where('categoryId', '==', newItem.budgetCategoryId)
            );
        }

        const sinkingFundSnapshot = await getDocs(sinkingFundQuery);
        const budgetItemsSnapshot = budgetItemsQuery ? await getDocs(budgetItemsQuery) : null;
        
        // All reads done, now writes
        transaction.set(newItemRef, itemData);

        await updateLinkedSinkingFund(transaction, sinkingFundSnapshot, newItem);
        if (newItem.budgetCategoryId && budgetItemsQuery) {
            await updateMonthlyBudget(transaction, budgetItemsQuery, null, newItem);
        }
        
        return newItemRef;
    });

  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<AutoShipItem, 'id'>) };
}

export async function updateAutoShipItem(id: string, itemData: Partial<Omit<AutoShipItem, 'id'>>): Promise<void> {
   await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, AUTOSHIP_COLLECTION, id);
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) {
            throw new Error("Auto-ship item not found");
        }
        const oldData = itemSnap.data() as AutoShipItem;
        const newData = { ...oldData, ...itemData, id };
        
        // Prepare queries for reads
        const sinkingFundQuery = query(collection(db, SINKING_FUNDS_COLLECTION), where('name', '==', newData.item), where('accountId', '==', newData.accountId));
        
        const currentMonth = new Date().toISOString().slice(0, 7);
        let budgetItemsQuery = null;
        if (newData.budgetCategoryId) {
            budgetItemsQuery = query(
                collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION),
                where('month', '==', currentMonth),
                where('categoryId', '==', newData.budgetCategoryId)
            );
        }
        
        let oldBudgetItemsQuery = null;
        if (oldData && oldData.budgetCategoryId && oldData.budgetCategoryId !== newData.budgetCategoryId) {
             oldBudgetItemsQuery = query(
                collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION),
                where('month', '==', currentMonth),
                where('categoryId', '==', oldData.budgetCategoryId)
            );
        }
        
        // Execute all reads
        const sinkingFundSnapshot = await getDocs(sinkingFundQuery);

        // Execute writes
        transaction.update(itemRef, itemData);
        await updateLinkedSinkingFund(transaction, sinkingFundSnapshot, newData, oldData);
        if (budgetItemsQuery || oldBudgetItemsQuery) {
            await updateMonthlyBudget(transaction, budgetItemsQuery!, oldBudgetItemsQuery, newData, oldData);
        }
    });
}

export async function deleteAutoShipItem(id: string): Promise<void> {
   await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, AUTOSHIP_COLLECTION, id);
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) {
            throw new Error("Auto-ship item not found");
        }
        const itemToDelete = {id, ...itemSnap.data()} as AutoShipItem;
        
        const sinkingFundQuery = query(collection(db, SINKING_FUNDS_COLLECTION), where('name', '==', itemToDelete.item), where('accountId', '==', itemToDelete.accountId));
        const sinkingFundSnapshot = await getDocs(sinkingFundQuery);

        let oldBudgetItemsQuery = null;
        if (itemToDelete.budgetCategoryId) {
            const currentMonth = new Date().toISOString().slice(0, 7);
            oldBudgetItemsQuery = query(
                collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION),
                where('month', '==', currentMonth),
                where('categoryId', '==', itemToDelete.budgetCategoryId)
            );
        }

        // All reads done
        transaction.delete(itemRef);

        if (!sinkingFundSnapshot.empty) {
            transaction.delete(sinkingFundSnapshot.docs[0].ref);
        }

        if (oldBudgetItemsQuery) {
            await updateMonthlyBudget(transaction, null, oldBudgetItemsQuery, {} as AutoShipItem, itemToDelete);
        }
    });
}

export async function advanceShipmentDate(id: string): Promise<void> {
    const itemRef = doc(db, AUTOSHIP_COLLECTION, id);
    const docSnap = await getDoc(itemRef);

    if (!docSnap.exists()) {
        throw new Error('Auto-ship item not found');
    }

    const item = docSnap.data() as AutoShipItem;
    const monthsToAdd = frequencyMap[item.frequency];
    const newShipmentDate = addMonths(new Date(item.nextShipmentDate), monthsToAdd);

    await updateDoc(itemRef, {
        nextShipmentDate: newShipmentDate.toISOString(),
    });
}
