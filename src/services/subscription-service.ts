

'use server';

import { db } from '@/lib/firebase';
import type { SubscriptionItem, MonthlyBudgetItem } from '@/types';
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
  runTransaction
} from 'firebase/firestore';

const SUBSCRIPTION_COLLECTION = 'subscriptions';
const SINKING_FUNDS_COLLECTION = 'sinking-funds';
const MONTHLY_BUDGET_ITEMS_COLLECTION = 'monthly-budget-items';


const getMonthlyCost = (item: Pick<SubscriptionItem, 'cost' | 'billingFrequency'>) => {
    switch (item.billingFrequency) {
        case 'Annually': return item.cost / 12;
        case 'Quarterly': return item.cost / 3;
        case 'Monthly': default: return item.cost;
    }
};

async function updateLinkedSinkingFund(
    transaction: FirebaseFirestore.Transaction,
    sinkingFundSnapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>,
    subscription: SubscriptionItem,
    oldSubscriptionData?: SubscriptionItem
) {
    const monthlyCost = getMonthlyCost(subscription);

    const fundData = {
        name: subscription.serviceName,
        amount: 0,
        goal: monthlyCost,
        totalCost: subscription.cost,
        dueDate: subscription.nextRenewalDate,
        accountId: subscription.accountId,
        currency: 'CAD', // Assuming CAD
        type: 'Subscription',
    };

    if (sinkingFundSnapshot.empty) {
        if (!oldSubscriptionData) { // Only create if it's a new subscription
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
    budgetItemsSnapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData> | null,
    oldBudgetItemsSnapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData> | null,
    subscription: SubscriptionItem,
    oldSubscriptionData?: SubscriptionItem
) {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const newMonthlyCost = getMonthlyCost(subscription);
    
    // Handle removal from the old category first
    if (oldBudgetItemsSnapshot && !oldBudgetItemsSnapshot.empty && oldSubscriptionData) {
        const oldBudgetDoc = oldBudgetItemsSnapshot.docs[0];
        const oldBudgetData = oldBudgetDoc.data() as MonthlyBudgetItem;
        // Filter out the old item from the breakdown
        const newBreakdown = oldBudgetData.breakdown?.filter(b => b.name !== oldSubscriptionData.serviceName) || [];
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
                breakdown: [{ name: subscription.serviceName, amount: newMonthlyCost }],
            });
        } else {
            // Category already has a budget item, update its breakdown and total.
            const budgetDoc = budgetItemsSnapshot.docs[0];
            const budgetData = budgetDoc.data() as MonthlyBudgetItem;
            
            const nameToFilter = oldSubscriptionData ? oldSubscriptionData.serviceName : subscription.serviceName;
            
            const existingBreakdown = budgetData.breakdown?.filter(b => b.name !== nameToFilter) || [];
            
            const newBreakdown = [...existingBreakdown, { name: subscription.serviceName, amount: newMonthlyCost }];
            
            const newBudgeted = newBreakdown.reduce((sum, item) => sum + item.amount, 0);

            transaction.update(budgetDoc.ref, { breakdown: newBreakdown, budgeted: newBudgeted });
        }
    }
}


export async function getSubscriptions(accountId: string): Promise<SubscriptionItem[]> {
  const subCollection = collection(db, SUBSCRIPTION_COLLECTION);
  const q = query(subCollection, where('accountId', '==', accountId));
  const querySnapshot = await getDocs(q);
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubscriptionItem));
  return items.sort((a, b) => a.serviceName.localeCompare(b.serviceName));
}

export async function addSubscription(itemData: Omit<SubscriptionItem, 'id'>): Promise<SubscriptionItem> {
    const docRef = await runTransaction(db, async (transaction) => {
        // --- Start READS ---
        const newDocRef = doc(collection(db, SUBSCRIPTION_COLLECTION));
        const newSubscription = { id: newDocRef.id, ...itemData };
        
        const sinkingFundQuery = query(collection(db, SINKING_FUNDS_COLLECTION), where('name', '==', newSubscription.serviceName), where('accountId', '==', newSubscription.accountId));
        let budgetItemsQuery = null;
        if (newSubscription.budgetCategoryId) {
            const currentMonth = new Date().toISOString().slice(0, 7);
            budgetItemsQuery = query(
                collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION),
                where('month', '==', currentMonth),
                where('categoryId', '==', newSubscription.budgetCategoryId)
            );
        }
        
        const sinkingFundSnapshot = await getDocs(sinkingFundQuery);
        const budgetItemsSnapshot = budgetItemsQuery ? await getDocs(budgetItemsQuery) : null;
        // --- End READS ---

        // --- Start WRITES ---
        transaction.set(newDocRef, itemData);
        await updateLinkedSinkingFund(transaction, sinkingFundSnapshot, newSubscription);
        if (newSubscription.budgetCategoryId) {
            await updateMonthlyBudget(transaction, budgetItemsSnapshot, null, newSubscription);
        }
        
        return newDocRef;
    });

    const docSnap = await getDoc(docRef);
    return { id: docSnap.id, ...(docSnap.data() as Omit<SubscriptionItem, 'id'>) };
}

export async function updateSubscription(id: string, itemData: Partial<Omit<SubscriptionItem, 'id'>>): Promise<void> {
     await runTransaction(db, async (transaction) => {
        // --- Start READS ---
        const itemRef = doc(db, SUBSCRIPTION_COLLECTION, id);
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) {
            throw new Error("Subscription not found");
        }
        const oldData = itemSnap.data() as SubscriptionItem;
        const newData = { ...oldData, ...itemData, id };
        
        const sinkingFundQuery = query(collection(db, SINKING_FUNDS_COLLECTION), where('name', '==', newData.serviceName), where('accountId', '==', newData.accountId));
        const sinkingFundSnapshot = await getDocs(sinkingFundQuery);
        
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
        if (oldData?.budgetCategoryId && oldData.budgetCategoryId !== newData.budgetCategoryId) {
            oldBudgetItemsQuery = query(
                collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION),
                where('month', '==', currentMonth),
                where('categoryId', '==', oldData.budgetCategoryId)
            );
        } else if (oldData?.budgetCategoryId && oldData.budgetCategoryId === newData.budgetCategoryId) {
            oldBudgetItemsQuery = budgetItemsQuery;
        }
        
        const [budgetItemsSnapshot, oldBudgetItemsSnapshot] = await Promise.all([
            budgetItemsQuery ? getDocs(budgetItemsQuery) : Promise.resolve(null),
            oldBudgetItemsQuery ? getDocs(oldBudgetItemsQuery) : Promise.resolve(null),
        ]);
        // --- End READS ---


        // --- Start WRITES ---
        transaction.update(itemRef, itemData);
        await updateLinkedSinkingFund(transaction, sinkingFundSnapshot, newData, oldData);
        if (newData.budgetCategoryId || oldData?.budgetCategoryId) {
             await updateMonthlyBudget(transaction, budgetItemsSnapshot, oldBudgetItemsSnapshot, newData, oldData);
        }
    });
}

export async function deleteSubscription(id: string): Promise<void> {
    await runTransaction(db, async (transaction) => {
        // --- Start READS ---
        const itemRef = doc(db, SUBSCRIPTION_COLLECTION, id);
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) {
            throw new Error("Subscription not found");
        }
        const subscriptionToDelete = {id, ...itemSnap.data()} as SubscriptionItem;
        
        const sinkingFundQuery = query(collection(db, SINKING_FUNDS_COLLECTION), where('name', '==', subscriptionToDelete.serviceName), where('accountId', '==', subscriptionToDelete.accountId));
        const sinkingFundSnapshot = await getDocs(sinkingFundQuery);
        
        let oldBudgetItemsQuery = null;
        if (subscriptionToDelete.budgetCategoryId) {
            const currentMonth = new Date().toISOString().slice(0, 7);
            oldBudgetItemsQuery = query(
                collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION),
                where('month', '==', currentMonth),
                where('categoryId', '==', subscriptionToDelete.budgetCategoryId)
            );
        }
        
        const oldBudgetItemsSnapshot = oldBudgetItemsQuery ? await getDocs(oldBudgetItemsQuery) : null;
        // --- End READS ---
        
        // --- Start WRITES ---
        transaction.delete(itemRef);

        if (!sinkingFundSnapshot.empty) {
            transaction.delete(sinkingFundSnapshot.docs[0].ref);
        }

        if (subscriptionToDelete.budgetCategoryId) {
            await updateMonthlyBudget(transaction, null, oldBudgetItemsSnapshot, {} as SubscriptionItem, subscriptionToDelete);
        }
    });
}
