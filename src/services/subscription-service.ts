
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
    subscription: SubscriptionItem,
    oldSubscriptionData?: SubscriptionItem
) {
    const monthlyCost = getMonthlyCost(subscription);
    const sinkingFundQuery = query(collection(db, SINKING_FUNDS_COLLECTION), where('name', '==', subscription.serviceName), where('accountId', '==', subscription.accountId));
    const sinkingFundSnapshot = await getDocs(sinkingFundQuery);

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
    subscription: SubscriptionItem,
    oldSubscriptionData?: SubscriptionItem
) {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const newMonthlyCost = getMonthlyCost(subscription);

    // Remove from old category if it exists and has changed
    if (oldSubscriptionData && oldSubscriptionData.budgetCategoryId && oldSubscriptionData.budgetCategoryId !== subscription.budgetCategoryId) {
        const oldMonthlyCost = getMonthlyCost(oldSubscriptionData);
        const oldBudgetItemsQuery = query(
            collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION),
            where('month', '==', currentMonth),
            where('categoryId', '==', oldSubscriptionData.budgetCategoryId)
        );
        const oldBudgetItemsSnapshot = await getDocs(oldBudgetItemsQuery);
        if (!oldBudgetItemsSnapshot.empty) {
            const budgetDoc = oldBudgetItemsSnapshot.docs[0];
            const budgetData = budgetDoc.data() as MonthlyBudgetItem;
            const newBreakdown = budgetData.breakdown?.filter(b => b.name !== oldSubscriptionData.serviceName) || [];
            const newBudgeted = newBreakdown.reduce((sum, item) => sum + item.amount, 0);
            transaction.update(budgetDoc.ref, { breakdown: newBreakdown, budgeted: newBudgeted });
        }
    }

    // Add to new category if it exists
    if (subscription.budgetCategoryId) {
        const budgetItemsQuery = query(
            collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION),
            where('month', '==', currentMonth),
            where('categoryId', '==', subscription.budgetCategoryId)
        );
        const budgetItemsSnapshot = await getDocs(budgetItemsQuery);

        if (budgetItemsSnapshot.empty) {
            const newBudgetItemRef = doc(collection(db, MONTHLY_BUDGET_ITEMS_COLLECTION));
            transaction.set(newBudgetItemRef, {
                categoryId: subscription.budgetCategoryId,
                month: currentMonth,
                budgeted: newMonthlyCost,
                breakdown: [{ name: subscription.serviceName, amount: newMonthlyCost }],
            });
        } else {
            const budgetDoc = budgetItemsSnapshot.docs[0];
            const budgetData = budgetDoc.data() as MonthlyBudgetItem;
            const existingBreakdown = budgetData.breakdown?.filter(b => b.name !== subscription.serviceName) || [];
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
        const newDocRef = doc(collection(db, SUBSCRIPTION_COLLECTION));
        const newSubscription = { id: newDocRef.id, ...itemData };
        transaction.set(newDocRef, itemData);

        await updateLinkedSinkingFund(transaction, newSubscription);
        if (newSubscription.budgetCategoryId) {
            await updateMonthlyBudget(transaction, newSubscription);
        }
        
        return newDocRef;
    });

    const docSnap = await getDoc(docRef);
    return { id: docSnap.id, ...(docSnap.data() as Omit<SubscriptionItem, 'id'>) };
}

export async function updateSubscription(id: string, itemData: Partial<Omit<SubscriptionItem, 'id'>>): Promise<void> {
     await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, SUBSCRIPTION_COLLECTION, id);
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) {
            throw new Error("Subscription not found");
        }
        const oldData = itemSnap.data() as SubscriptionItem;
        const newData = { ...oldData, ...itemData, id };
        
        transaction.update(itemRef, itemData);
        
        await updateLinkedSinkingFund(transaction, newData, oldData);
        await updateMonthlyBudget(transaction, newData, oldData);
    });
}

export async function deleteSubscription(id: string): Promise<void> {
    await runTransaction(db, async (transaction) => {
        const itemRef = doc(db, SUBSCRIPTION_COLLECTION, id);
        const itemSnap = await transaction.get(itemRef);
        if (!itemSnap.exists()) {
            throw new Error("Subscription not found");
        }
        const subscriptionToDelete = itemSnap.data() as SubscriptionItem;
        
        // Delete the subscription
        transaction.delete(itemRef);

        // Delete the linked sinking fund
        const sinkingFundQuery = query(collection(db, SINKING_FUNDS_COLLECTION), where('name', '==', subscriptionToDelete.serviceName), where('accountId', '==', subscriptionToDelete.accountId));
        const sinkingFundSnapshot = await getDocs(sinkingFundQuery);
        if (!sinkingFundSnapshot.empty) {
            transaction.delete(sinkingFundSnapshot.docs[0].ref);
        }

        // Remove from monthly budget
        if (subscriptionToDelete.budgetCategoryId) {
            await updateMonthlyBudget(transaction, { ...subscriptionToDelete, budgetCategoryId: undefined }, subscriptionToDelete);
        }
    });
}
