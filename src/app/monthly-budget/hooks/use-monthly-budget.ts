'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useMonthlyBudget(selectedMonth: string) {
  const [budgetItems, setBudgetItems] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch Categories
    const unsubCats = onSnapshot(collection(db, 'budget-categories'), (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // 2. Fetch Budget Items for the specific month
    // Note: If your data doesn't have a 'month' field yet, remove the 'where' clause temporarily
    const qItems = query(
      collection(db, 'budget-items'),
      // where('month', '==', selectedMonth) // Uncomment this once you have month data
    );

    const unsubItems = onSnapshot(qItems, (snapshot) => {
      console.log(`Hook found ${snapshot.size} items for month: ${selectedMonth}`);
      const items = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          // MAPPING FIX: UI expects 'budgeted', DB has 'amount'
          budgeted: data.budgeted || data.amount || 0,
          // MAPPING FIX: UI expects 'categoryId', DB has 'category'
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

  // Placeholders for functions called in your page.tsx
  const updateBudgetItemWithBreakdown = async () => {};
  const updateBudgetItem = async () => {};
  const copyCategoryFromPreviousMonth = async () => {};
  const copyBudgetItemToNextMonth = async () => {};
  const cycleToNextMonth = async () => {};

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