'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BudgetItem } from '@/types';

const BUDGET_STORAGE_KEY = 'tasktrack-budget-budget-items';

export function useBudget() {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      try {
        const storedBudgetItems = localStorage.getItem(BUDGET_STORAGE_KEY);
        if (storedBudgetItems) {
          setBudgetItems(JSON.parse(storedBudgetItems));
        }
      } catch (error) {
        console.error('Failed to load budget items from local storage:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [isClient]);

  useEffect(() => {
    if (isClient && !isLoading) {
      try {
        localStorage.setItem(BUDGET_STORAGE_KEY, JSON.stringify(budgetItems));
      } catch (error) {
        console.error('Failed to save budget items to local storage:', error);
      }
    }
  }, [budgetItems, isLoading, isClient]);

  const addBudgetItem = useCallback((itemData: Omit<BudgetItem, 'id'>) => {
    const newItem: BudgetItem = {
      ...itemData,
      id: crypto.randomUUID(),
    };
    setBudgetItems((prevItems) => [...prevItems, newItem]);
  }, []);

  const updateBudgetItem = useCallback((id: string, itemData: Omit<BudgetItem, 'id'>) => {
    setBudgetItems((prevItems) =>
      prevItems.map((item) => (item.id === id ? { ...item, ...itemData } : item))
    );
  }, []);

  const deleteBudgetItem = useCallback((id: string) => {
    setBudgetItems((prevItems) => prevItems.filter((item) => item.id !== id));
  }, []);

  return { budgetItems, addBudgetItem, updateBudgetItem, deleteBudgetItem, isLoading };
}
