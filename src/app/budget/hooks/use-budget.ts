
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BudgetItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as BudgetService from '@/app/budget/services/budget-service';
import { useAccountDetails } from '@/hooks/use-account-details';

export function useBudget() {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { fetchAccounts } = useAccountDetails();


  const fetchBudgetItems = useCallback(async () => {
      try {
        setIsLoading(true);
        const fetchedItems = await BudgetService.getBudgetItems();
        setBudgetItems(fetchedItems);
      } catch (error: any) {
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
      await BudgetService.addBudgetItem(itemData);
      await fetchBudgetItems(); // refetch to get the correct state
      if (itemData.type === 'Income' || itemData.type === 'Transfers') {
        await fetchAccounts();
      }
    } catch (error) {
      console.error('Failed to add budget item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new budget item.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchAccounts, fetchBudgetItems]);

  const updateBudgetItem = useCallback(async (id: string, itemData: Partial<Omit<BudgetItem, 'id' | 'originalId'>>) => {
    try {
      await BudgetService.updateBudgetItem(id, itemData);
      await fetchBudgetItems(); // Refetch to show the new one-time item and remove the old instance
      if (itemData.type === 'Income' || itemData.type === 'Transfers') {
        await fetchAccounts();
      }
    } catch (error) {
      console.error('Failed to update budget item:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the budget item.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchAccounts, fetchBudgetItems]);

  const deleteBudgetItem = useCallback(async (id: string) => {
    try {
      await BudgetService.deleteBudgetItem(id);
      await fetchBudgetItems();
    } catch (error) {
      console.error('Failed to delete budget item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the budget item.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchBudgetItems]);

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

  const cycleBudgetItems = useCallback(async () => {
    try {
      await BudgetService.cycleBudgetItems();
      await fetchBudgetItems();
      toast({
        title: 'Success!',
        description: 'Budget items have been cycled for the next month.',
      });
    } catch (error) {
      console.error('Failed to cycle budget items:', error);
      toast({
        title: 'Error',
        description: 'Could not cycle budget items.',
        variant: 'destructive',
      });
    }
  }, [fetchBudgetItems, toast]);

  return { 
    budgetItems, 
    addBudgetItem, 
    updateBudgetItem, 
    deleteBudgetItem, 
    toggleBudgetItemCompleted, 
    cycleBudgetItems,
    isLoading,
    fetchBudgetItems,
  };
}

    