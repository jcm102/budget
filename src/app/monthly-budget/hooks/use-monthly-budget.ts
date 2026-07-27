'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, where, doc, addDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import * as MonthlyBudgetService from '../services/monthly-budget-service';
import { format } from 'date-fns';

export function useMonthlyBudget(selectedMonth: string = format(new Date(), 'yyyy-MM')) {
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Auto-carry forward recurring items on mount/month change
    MonthlyBudgetService.initializeMonthBudget(db, selectedMonth).catch(console.error);

    // Auto-cycle checklist/overview items when calendar month changes
    MonthlyBudgetService.checkAndAutoCycle(db).catch(console.error);

    // 1. Fetch Categories
    const unsubCats = onSnapshot(collection(db, 'budget-categories'), (snapshot) => {
      setCategories(snapshot.docs
        .filter(doc => doc.id !== '_seeded')
        .map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 2. Fetch Budget Items for the specific month
    const qItems = query(
      collection(db, 'monthly-budget-items'),
      where('month', '==', selectedMonth)
    );

    const unsubItems = onSnapshot(qItems, (snapshot) => {
      console.log(`Hook found ${snapshot.size} items for month: ${selectedMonth}`);
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          budgeted: data.budgeted || data.amount || 0,
          categoryId: data.categoryId || data.category || 'uncategorized',
          name: data.description || data.name || 'Unnamed Item'
        };
      });
      setBudgetItems(items);
      setIsLoading(false);
    });

    return () => {
      unsubCats();
      unsubItems();
    };
  }, [selectedMonth]);

  const updateBudgetItem = async (categoryId: string, budgeted: number) => {
    const existing = budgetItems.find(item => item.categoryId === categoryId);
    if (existing) {
      await updateDoc(doc(db, 'monthly-budget-items', existing.id), { budgeted });
    } else {
      await addDoc(collection(db, 'monthly-budget-items'), {
        categoryId,
        budgeted,
        month: selectedMonth,
        breakdown: []
      });
    }
  };

  const updateBudgetItemWithBreakdown = async (categoryId: string, breakdown: any[]) => {
    const budgeted = breakdown.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const existing = budgetItems.find(item => item.categoryId === categoryId);
    if (existing) {
      await updateDoc(doc(db, 'monthly-budget-items', existing.id), { budgeted, breakdown });
    } else {
      await addDoc(collection(db, 'monthly-budget-items'), {
        categoryId,
        budgeted,
        month: selectedMonth,
        breakdown
      });
    }
  };

  const copyCategoryFromPreviousMonth = async () => {};
  
  const copyBudgetItemToNextMonth = async (item: any) => {
    await MonthlyBudgetService.copyBudgetItemToNextMonth(db, item);
  };
  
  const cycleToNextMonth = async () => {
    await MonthlyBudgetService.cycleToNextMonth(db);
  };

  return { 
    budgetItems, 
    categories, 
    isLoading, 
    updateBudgetItemWithBreakdown,
    updateBudgetItem,
    copyCategoryFromPreviousMonth,
    copyBudgetItemToNextMonth,
    cycleToNextMonth
  };
}