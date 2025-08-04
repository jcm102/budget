'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BudgetItem } from '@/types';
import { useToast } from './use-toast';
import * as BudgetService from '@/services/budget-service';

export function useBudget() {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchBudgetItems = async () => {
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
    };
    fetchBudgetItems();
  }, [toast]);

  const addBudgetItem = useCallback(async (itemData: Omit<BudgetItem, 'id'>) => {
    try {
      const newItem = await BudgetService.addBudgetItem(itemData);
      setBudgetItems((prev) => [...prev, newItem]);
    } catch (error) {
      console.error('Failed to add budget item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new budget item.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const updateBudgetItem = useCallback(async (id: string, itemData: Omit<BudgetItem, 'id'>) => {
    const originalItems = budgetItems;
    setBudgetItems((prev) =>
      prev.map((item) => (item.id === id ? { id, ...itemData } : item))
    );
    try {
      await BudgetService.updateBudgetItem(id, itemData);
    } catch (error) {
      console.error('Failed to update budget item:', error);
      setBudgetItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update the budget item.',
        variant: 'destructive',
      });
    }
  }, [budgetItems, toast]);

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

  return { budgetItems, addBudgetItem, updateBudgetItem, deleteBudgetItem, isLoading };
}
