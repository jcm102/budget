
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BudgetItem } from '@/types';
import { useToast } from './use-toast';
import * as BudgetService from '@/services/budget-service';

export function useBudget() {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchBudgetItems = useCallback(async () => {
      try {
        setIsLoading(true);
        const fetchedItems = await BudgetService.getBudgetItems();
        setBudgetItems(fetchedItems);
      } catch (error) {
        console.error('Failed to load budget items:', error);
        toast({
          title: 'Error',
          description: 'Failed to load budget items from the database.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }, [toast]);

  useEffect(() => {
    fetchBudgetItems();
  }, [fetchBudgetItems]);

  const addBudgetItem = useCallback(async (itemData: Omit<BudgetItem, 'id'>) => {
    try {
      const newItem = await BudgetService.addBudgetItem(itemData);
      setBudgetItems((prev) => [...prev, newItem]);
      await fetchBudgetItems(); // refetch to get the correct state
    } catch (error) {
      console.error('Failed to add budget item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new budget item.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchBudgetItems]);

  const updateBudgetItem = useCallback(async (id: string, itemData: Omit<BudgetItem, 'id'>) => {
    const originalItems = budgetItems;
    // Optimistic update
    const isRecurringInstance = id.includes('-');
    if (isRecurringInstance) {
        // If it's a recurring instance, we expect it to be replaced by a new one-time item.
        // The fetchBudgetItems call will handle the display logic.
        setBudgetItems(prev => prev.filter(item => item.id !== id));
    } else {
        setBudgetItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...itemData } as BudgetItem : item))
        );
    }

    try {
      await BudgetService.updateBudgetItem(id, itemData);
      await fetchBudgetItems(); // Refetch to show the new one-time item and remove the old instance
    } catch (error) {
      console.error('Failed to update budget item:', error);
      setBudgetItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update the budget item.',
        variant: 'destructive',
      });
    }
  }, [budgetItems, toast, fetchBudgetItems]);

  const deleteBudgetItem = useCallback(async (id: string) => {
    const originalItems = budgetItems;
    setBudgetItems((prev) => prev.filter((item) => item.id !== id));
    try {
      await BudgetService.deleteBudgetItem(id);
    } catch (error) {
      console.error('Failed to delete budget item:', error);
      setBudgetItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to delete the budget item.',
        variant: 'destructive',
      });
    }
  }, [budgetItems, toast]);

  const toggleBudgetItemCompleted = useCallback(async (id: string, completed: boolean) => {
    const originalItems = [...budgetItems];
    setBudgetItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
    try {
      await BudgetService.updateBudgetItem(id, { completed: !completed });
    } catch (error) {
      console.error('Failed to toggle budget item:', error);
      setBudgetItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update item completion status.',
        variant: 'destructive',
      });
    }
  }, [budgetItems, toast]);

  const syncDebtPayments = useCallback(async () => {
    try {
      await BudgetService.syncDebtPayments();
      // After a successful sync, refetch all items to update the UI
      await fetchBudgetItems();
    } catch (error) {
      console.error('Failed to sync debt payments:', error);
      // The calling component will handle the toast
      throw error;
    }
  }, [fetchBudgetItems]);

  const clearDebtPayments = useCallback(async () => {
    try {
      await BudgetService.clearDebtPayments();
      await fetchBudgetItems();
    } catch (error) {
      console.error('Failed to clear debt payments:', error);
      throw error;
    }
  }, [fetchBudgetItems]);

  return { 
    budgetItems, 
    addBudgetItem, 
    updateBudgetItem, 
    deleteBudgetItem, 
    toggleBudgetItemCompleted, 
    isLoading,
    syncDebtPayments,
    clearDebtPayments,
    fetchBudgetItems,
  };
}
