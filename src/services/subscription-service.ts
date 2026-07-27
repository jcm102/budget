'use server';

import { db } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import type { SubscriptionItem, MonthlyBudgetItem } from '@/types';

const SUBSCRIPTION_COLLECTION = 'subscriptions';
const MONTHLY_BUDGET_ITEMS_COLLECTION = 'monthly-budget-items';

const getMonthlyCost = (item: Pick<SubscriptionItem, 'cost' | 'billingFrequency'>) => {
  switch (item.billingFrequency) {
    case 'Annually': return item.cost / 12;
    case 'Quarterly': return item.cost / 3;
    case 'Monthly': default: return item.cost;
  }
};

async function updateMonthlyBudget(
  transaction: admin.firestore.Transaction,
  budgetItemsSnapshot: admin.firestore.QuerySnapshot | null,
  oldBudgetItemsSnapshot: admin.firestore.QuerySnapshot | null,
  subscription: SubscriptionItem,
  oldSubscriptionData?: SubscriptionItem
) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const newMonthlyCost = getMonthlyCost(subscription);

  if (oldBudgetItemsSnapshot && !oldBudgetItemsSnapshot.empty && oldSubscriptionData) {
    const oldBudgetDoc = oldBudgetItemsSnapshot.docs[0];
    const oldBudgetData = oldBudgetDoc.data() as MonthlyBudgetItem;
    const newBreakdown = oldBudgetData.breakdown?.filter(b => b.name !== oldSubscriptionData.serviceName) || [];
    const newBudgeted = newBreakdown.reduce((sum, item) => sum + item.amount, 0);
    transaction.update(oldBudgetDoc.ref, { breakdown: newBreakdown, budgeted: newBudgeted });
  }

  if (subscription.budgetCategoryId && budgetItemsSnapshot) {
    if (budgetItemsSnapshot.empty) {
      const newBudgetItemRef = db.collection(MONTHLY_BUDGET_ITEMS_COLLECTION).doc();
      transaction.set(newBudgetItemRef, {
        categoryId: subscription.budgetCategoryId,
        month: currentMonth,
        budgeted: newMonthlyCost,
        breakdown: [{ name: subscription.serviceName, amount: newMonthlyCost }],
      });
    } else {
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
  let query = db.collection(SUBSCRIPTION_COLLECTION);
  if (accountId !== 'all') {
    query = query.where('accountId', '==', accountId) as any;
  }
  const querySnapshot = await query.get();
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubscriptionItem));
  return items.sort((a, b) => a.serviceName.localeCompare(b.serviceName));
}

export async function addSubscription(itemData: Omit<SubscriptionItem, 'id'>): Promise<SubscriptionItem> {
  const newDocRef = db.collection(SUBSCRIPTION_COLLECTION).doc();
  const newSubscription = { id: newDocRef.id, ...itemData };
  const currentMonth = new Date().toISOString().slice(0, 7);

  await db.runTransaction(async (transaction) => {
    let budgetItemsSnapshot: FirebaseFirestore.QuerySnapshot | null = null;
    if (newSubscription.budgetCategoryId) {
      budgetItemsSnapshot = await db.collection(MONTHLY_BUDGET_ITEMS_COLLECTION)
        .where('month', '==', currentMonth)
        .where('categoryId', '==', newSubscription.budgetCategoryId)
        .get();
    }
    transaction.set(newDocRef, itemData);
    if (newSubscription.budgetCategoryId) {
      await updateMonthlyBudget(transaction, budgetItemsSnapshot, null, newSubscription);
    }
  });

  const docSnap = await newDocRef.get();
  return { id: docSnap.id, ...(docSnap.data() as Omit<SubscriptionItem, 'id'>) };
}

export async function updateSubscription(id: string, itemData: Partial<Omit<SubscriptionItem, 'id'>>): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  await db.runTransaction(async (transaction) => {
    const itemRef = db.collection(SUBSCRIPTION_COLLECTION).doc(id);
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists) throw new Error('Subscription not found');
    const oldData = itemSnap.data() as SubscriptionItem;
    const newData = { ...oldData, ...itemData, id };

    let budgetItemsSnapshot: FirebaseFirestore.QuerySnapshot | null = null;
    if (newData.budgetCategoryId) {
      budgetItemsSnapshot = await db.collection(MONTHLY_BUDGET_ITEMS_COLLECTION)
        .where('month', '==', currentMonth)
        .where('categoryId', '==', newData.budgetCategoryId)
        .get();
    }

    let oldBudgetItemsSnapshot: FirebaseFirestore.QuerySnapshot | null = null;
    if (oldData?.budgetCategoryId && oldData.budgetCategoryId !== newData.budgetCategoryId) {
      oldBudgetItemsSnapshot = await db.collection(MONTHLY_BUDGET_ITEMS_COLLECTION)
        .where('month', '==', currentMonth)
        .where('categoryId', '==', oldData.budgetCategoryId)
        .get();
    } else if (oldData?.budgetCategoryId && oldData.budgetCategoryId === newData.budgetCategoryId) {
      oldBudgetItemsSnapshot = budgetItemsSnapshot;
    }

    transaction.update(itemRef, itemData);
    if (newData.budgetCategoryId || oldData?.budgetCategoryId) {
      await updateMonthlyBudget(transaction, budgetItemsSnapshot, oldBudgetItemsSnapshot, newData, oldData);
    }
  });
}

export async function deleteSubscription(id: string): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  await db.runTransaction(async (transaction) => {
    const itemRef = db.collection(SUBSCRIPTION_COLLECTION).doc(id);
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists) throw new Error('Subscription not found');
    const subscriptionToDelete = { id, ...itemSnap.data() } as SubscriptionItem;

    let oldBudgetItemsSnapshot: FirebaseFirestore.QuerySnapshot | null = null;
    if (subscriptionToDelete.budgetCategoryId) {
      oldBudgetItemsSnapshot = await db.collection(MONTHLY_BUDGET_ITEMS_COLLECTION)
        .where('month', '==', currentMonth)
        .where('categoryId', '==', subscriptionToDelete.budgetCategoryId)
        .get();
    }

    transaction.delete(itemRef);
    if (subscriptionToDelete.budgetCategoryId) {
      await updateMonthlyBudget(transaction, null, oldBudgetItemsSnapshot, {} as SubscriptionItem, subscriptionToDelete);
    }
  });
}
