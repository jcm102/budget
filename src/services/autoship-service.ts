
'use server';

import { db } from '@/lib/firebase-admin';
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
import { addMonths, format } from 'date-fns';

const AUTOSHIP_COLLECTION = 'autoship-items';
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


async function updateMonthlyBudget(
    transaction: FirebaseFirestore.Transaction,
    budgetItemsSnapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData> | null,
    oldBudgetItemsSnapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData> | null,
    subscription: AutoShipItem,
    oldSubscriptionData?: AutoShipItem
) {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const newMonthlyCost = getMonthlyCost(subscription);
    
    // Handle removal from the old category first
    if (oldBudgetItemsSnapshot && !oldBudgetItemsSnapshot.empty && oldSubscriptionData) {
        const oldBudgetDoc = oldBudgetItemsSnapshot.docs[0];
        const oldBudgetData = oldBudgetDoc.data() as MonthlyBudgetItem;
        // Filter out the old item from the breakdown
        const newBreakdown = oldBudgetData.breakdown?.filter(b => b.name !== oldSubscriptionData.item) || [];
        const newBudgeted = newBreakdown.reduce((sum, item) => sum + item.amount, 0);
        transaction.update(oldBudgetDoc.ref, { breakdown: newBreakdown, budgeted: newBudgeted });
    }

    // Handle adding to the new category
    if (subscription.budgetCategoryId && budgetItemsSnapshot) {
         if (budgetItemsSnapshot.empty) {
            // Category has no budget item for this month yet, create a new one.
            const newBudgetItemRef = doc(collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION));
            transaction.set(newBudgetItemRef, {
                categoryId: subscription.budgetCategoryId,
                month: currentMonth,
                budgeted: newMonthlyCost,
                breakdown: [{ name: subscription.item, amount: newMonthlyCost }],
            });
        } else {
            // Category already has a budget item, update its breakdown and total.
            const budgetDoc = budgetItemsSnapshot.docs[0];
            const budgetData = budgetDoc.data() as MonthlyBudgetItem;
            
            const nameToFilter = oldSubscriptionData ? oldSubscriptionData.item : subscription.item;

            const existingBreakdown = budgetData.breakdown?.filter(b => b.name !== nameToFilter) || [];
             
            const newBreakdown = [...existingBreakdown, { name: subscription.item, amount: newMonthlyCost }];
            
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
        const newAutoShipItem = { id: newItemRef.id, ...itemData };
        
        // --- Start READS ---
        let budgetItemsQuery = null;
        if (newAutoShipItem.budgetCategoryId) {
             const currentMonth = new Date().toISOString().slice(0, 7);
             budgetItemsQuery = query(
                collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION),
                where('month', '==', currentMonth),
                where('categoryId', '==', newAutoShipItem.budgetCategoryId)
            );
        }

        const budgetItemsSnapshot = budgetItemsQuery ? await getDocs(budgetItemsQuery) : null;
        // --- End READS ---
        
        // --- Start WRITES ---
        transaction.set(newItemRef, itemData);

        if (newAutoShipItem.budgetCategoryId) {
            await updateMonthlyBudget(transaction, budgetItemsSnapshot, null, newAutoShipItem);
        }
        
        return newItemRef;
    });

  const docSnap = await getDoc(docRef);
  return { id: docSnap.id, ...(docSnap.data() as Omit<AutoShipItem, 'id'>) };
}

export async function updateAutoShipItem(id: string, itemData: Partial<Omit<AutoShipItem, 'id'>>): Promise<void> {
   await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, AUTOSHIP_COLLECTION, id);

        // --- Start READS ---
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) {
            throw new Error("Auto-ship item not found");
        }
        const oldData = itemSnap.data() as AutoShipItem;
        const newData = { ...oldData, ...itemData, id };
        
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
        } else if (oldData && oldData.budgetCategoryId && oldData.budgetCategoryId === newData.budgetCategoryId) {
             oldBudgetItemsQuery = budgetItemsQuery;
        }
        
        const [budgetItemsSnapshot, oldBudgetItemsSnapshot] = await Promise.all([
          budgetItemsQuery ? getDocs(budgetItemsQuery) : Promise.resolve(null),
          oldBudgetItemsQuery ? getDocs(oldBudgetItemsQuery) : Promise.resolve(null),
        ]);
        // --- End READS ---


        // --- Start WRITES ---
        transaction.update(itemRef, itemData);
        if (newData.budgetCategoryId || oldData.budgetCategoryId) {
            await updateMonthlyBudget(transaction, budgetItemsSnapshot, oldBudgetItemsSnapshot, newData, oldData);
        }
    });
}

export async function deleteAutoShipItem(id: string): Promise<void> {
   await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, AUTOSHIP_COLLECTION, id);
        
        // --- Start READS ---
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) {
            throw new Error("Auto-ship item not found");
        }
        const itemToDelete = {id, ...itemSnap.data()} as AutoShipItem;
        
        let oldBudgetItemsQuery = null;
        if (itemToDelete.budgetCategoryId) {
            const currentMonth = new Date().toISOString().slice(0, 7);
            oldBudgetItemsQuery = query(
                collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION),
                where('month', '==', currentMonth),
                where('categoryId', '==', itemToDelete.budgetCategoryId)
            );
        }
        
        const oldBudgetItemsSnapshot = oldBudgetItemsQuery ? await getDocs(oldBudgetItemsQuery) : null;
        // --- End READS ---
        
        // --- Start WRITES ---
        transaction.delete(itemRef);

        if (itemToDelete.budgetCategoryId) {
            await updateMonthlyBudget(transaction, null, oldBudgetItemsSnapshot, {} as AutoShipItem, itemToDelete);
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
        nextShipmentDate: format(newShipmentDate, 'yyyy-MM-dd'),
    });
}
