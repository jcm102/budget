
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
    autoShipItem: AutoShipItem,
    oldAutoShipData?: AutoShipItem
) {
    const monthlyCost = getMonthlyCost(autoShipItem);
    const sinkingFundQuery = query(collection(db, SINKING_FUNDS_COLLECTION), where('name', '==', autoShipItem.item), where('accountId', '==', autoShipItem.accountId));
    const sinkingFundSnapshot = await getDocs(sinkingFundQuery);

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
    autoShipItem: AutoShipItem,
    oldAutoShipData?: AutoShipItem
) {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const newMonthlyCost = getMonthlyCost(autoShipItem);

    // Remove from old category if it exists and has changed
    if (oldAutoShipData && oldAutoShipData.budgetCategoryId && oldAutoShipData.budgetCategoryId !== autoShipItem.budgetCategoryId) {
        const oldMonthlyCost = getMonthlyCost(oldAutoShipData);
        const oldBudgetItemsQuery = query(
            collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION),
            where('month', '==', currentMonth),
            where('categoryId', '==', oldAutoShipData.budgetCategoryId)
        );
        const oldBudgetItemsSnapshot = await getDocs(oldBudgetItemsQuery);
        if (!oldBudgetItemsSnapshot.empty) {
            const budgetDoc = oldBudgetItemsSnapshot.docs[0];
            const budgetData = budgetDoc.data() as MonthlyBudgetItem;
            const newBreakdown = budgetData.breakdown?.filter(b => b.name !== oldAutoShipData.item) || [];
            const newBudgeted = newBreakdown.reduce((sum, item) => sum + item.amount, 0);
            transaction.update(budgetDoc.ref, { breakdown: newBreakdown, budgeted: newBudgeted });
        }
    }

    // Add to new category if it exists
    if (autoShipItem.budgetCategoryId) {
        const budgetItemsQuery = query(
            collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION),
            where('month', '==', currentMonth),
            where('categoryId', '==', autoShipItem.budgetCategoryId)
        );
        const budgetItemsSnapshot = await getDocs(budgetItemsQuery);

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
        const newDocRef = doc(collection(db, AUTOSHIP_COLLECTION));
        const newItem = { id: newDocRef.id, ...itemData };
        transaction.set(newDocRef, itemData);

        await updateLinkedSinkingFund(transaction, newItem);
        if (newItem.budgetCategoryId) {
            await updateMonthlyBudget(transaction, newItem);
        }
        
        return newDocRef;
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
        
        transaction.update(itemRef, itemData);
        
        await updateLinkedSinkingFund(transaction, newData, oldData);
        await updateMonthlyBudget(transaction, newData, oldData);
    });
}

export async function deleteAutoShipItem(id: string): Promise<void> {
   await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, AUTOSHIP_COLLECTION, id);
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) {
            throw new Error("Auto-ship item not found");
        }
        const itemToDelete = itemSnap.data() as AutoShipItem;
        
        // Delete the item
        transaction.delete(itemRef);

        // Delete the linked sinking fund
        const sinkingFundQuery = query(collection(db, SINKING_FUNDS_COLLECTION), where('name', '==', itemToDelete.item), where('accountId', '==', itemToDelete.accountId));
        const sinkingFundSnapshot = await getDocs(sinkingFundQuery);
        if (!sinkingFundSnapshot.empty) {
            transaction.delete(sinkingFundSnapshot.docs[0].ref);
        }

        // Remove from monthly budget
        if (itemToDelete.budgetCategoryId) {
            await updateMonthlyBudget(transaction, { ...itemToDelete, budgetCategoryId: undefined }, itemToDelete);
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
