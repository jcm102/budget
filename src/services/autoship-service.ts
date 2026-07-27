'use server';

import { db } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import type { AutoShipItem, AutoShipFrequency, MonthlyBudgetItem } from '@/types';
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
  return item.estimatedCost / frequencyMap[item.frequency];
};

async function updateMonthlyBudget(
  transaction: admin.firestore.Transaction,
  budgetItemsSnapshot: admin.firestore.QuerySnapshot | null,
  oldBudgetItemsSnapshot: admin.firestore.QuerySnapshot | null,
  subscription: AutoShipItem,
  oldSubscriptionData?: AutoShipItem
) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const newMonthlyCost = getMonthlyCost(subscription);

  if (oldBudgetItemsSnapshot && !oldBudgetItemsSnapshot.empty && oldSubscriptionData) {
    const oldBudgetDoc = oldBudgetItemsSnapshot.docs[0];
    const oldBudgetData = oldBudgetDoc.data() as MonthlyBudgetItem;
    const newBreakdown = oldBudgetData.breakdown?.filter(b => b.name !== oldSubscriptionData.item) || [];
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
        breakdown: [{ name: subscription.item, amount: newMonthlyCost }],
      });
    } else {
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
  let query = db.collection(AUTOSHIP_COLLECTION);
  if (accountId !== 'all') {
    query = query.where('accountId', '==', accountId) as any;
  }
  const querySnapshot = await query.get();
  const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AutoShipItem));
  return items.sort((a, b) => new Date(a.nextShipmentDate).getTime() - new Date(b.nextShipmentDate).getTime());
}

export async function addAutoShipItem(itemData: Omit<AutoShipItem, 'id'>): Promise<AutoShipItem> {
  const newItemRef = db.collection(AUTOSHIP_COLLECTION).doc();
  const newAutoShipItem = { id: newItemRef.id, ...itemData };
  const currentMonth = new Date().toISOString().slice(0, 7);

  await db.runTransaction(async (transaction) => {
    let budgetItemsSnapshot: FirebaseFirestore.QuerySnapshot | null = null;
    if (newAutoShipItem.budgetCategoryId) {
      budgetItemsSnapshot = await db.collection(MONTHLY_BUDGET_ITEMS_COLLECTION)
        .where('month', '==', currentMonth)
        .where('categoryId', '==', newAutoShipItem.budgetCategoryId)
        .get();
    }
    transaction.set(newItemRef, itemData);
    if (newAutoShipItem.budgetCategoryId) {
      await updateMonthlyBudget(transaction, budgetItemsSnapshot, null, newAutoShipItem);
    }
  });

  const docSnap = await newItemRef.get();
  return { id: docSnap.id, ...(docSnap.data() as Omit<AutoShipItem, 'id'>) };
}

export async function updateAutoShipItem(id: string, itemData: Partial<Omit<AutoShipItem, 'id'>>): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  await db.runTransaction(async (transaction) => {
    const itemRef = db.collection(AUTOSHIP_COLLECTION).doc(id);
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists) throw new Error('Auto-ship item not found');
    const oldData = itemSnap.data() as AutoShipItem;
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

export async function deleteAutoShipItem(id: string): Promise<void> {
  const currentMonth = new Date().toISOString().slice(0, 7);
  await db.runTransaction(async (transaction) => {
    const itemRef = db.collection(AUTOSHIP_COLLECTION).doc(id);
    const itemSnap = await transaction.get(itemRef);
    if (!itemSnap.exists) throw new Error('Auto-ship item not found');
    const itemToDelete = { id, ...itemSnap.data() } as AutoShipItem;

    let oldBudgetItemsSnapshot: FirebaseFirestore.QuerySnapshot | null = null;
    if (itemToDelete.budgetCategoryId) {
      oldBudgetItemsSnapshot = await db.collection(MONTHLY_BUDGET_ITEMS_COLLECTION)
        .where('month', '==', currentMonth)
        .where('categoryId', '==', itemToDelete.budgetCategoryId)
        .get();
    }

    transaction.delete(itemRef);
    if (itemToDelete.budgetCategoryId) {
      await updateMonthlyBudget(transaction, null, oldBudgetItemsSnapshot, {} as AutoShipItem, itemToDelete);
    }
  });
}

export async function advanceShipmentDate(id: string): Promise<void> {
  const docSnap = await db.collection(AUTOSHIP_COLLECTION).doc(id).get();
  if (!docSnap.exists) throw new Error('Auto-ship item not found');
  const item = docSnap.data() as AutoShipItem;
  const monthsToAdd = frequencyMap[item.frequency];
  const newShipmentDate = addMonths(new Date(item.nextShipmentDate), monthsToAdd);
  await db.collection(AUTOSHIP_COLLECTION).doc(id).update({
    nextShipmentDate: format(newShipmentDate, 'yyyy-MM-dd'),
  });
}
