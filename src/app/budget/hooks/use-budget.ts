
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BudgetItem, BudgetItemType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as BudgetService from '@/app/budget/services/budget-service';
import { useAccountDetails } from '@/hooks/use-transferees';
import { useFirestore } from '@/firebase';

export function useBudget() {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { fetchAccounts } = useAccountDetails();
  const db = useFirestore();


  const fetchBudgetItems = useCallback(async () => {
      if (!db) return;
      try {
        setIsLoading(true);
        const fetchedItems = await BudgetService.getBudgetItems(db);
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
    }, [toast, db]);

  useEffect(() => {
    fetchBudgetItems();
  }, [fetchBudgetItems]);

  const addBudgetItem = useCallback(async (itemData: Omit<BudgetItem, 'id'>) => {
    if (!db) return;
    try {
      await BudgetService.addBudgetItem(db, itemData);
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
  }, [toast, fetchAccounts, fetchBudgetItems, db]);

  const updateBudgetItem = useCallback(async (id: string, itemData: Partial<Omit<BudgetItem, 'id' | 'originalId'>>) => {
    if (!db) return;
    try {
      await BudgetService.updateBudgetItem(db, id, itemData);
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
  }, [toast, fetchAccounts, fetchBudgetItems, db]);

  const deleteBudgetItem = useCallback(async (id: string) => {
    if (!db) return;
    try {
      await BudgetService.deleteBudgetItem(db, id);
      await fetchBudgetItems();
    } catch (error) {
      console.error('Failed to delete budget item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the budget item.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchBudgetItems, db]);

  const toggleBudgetItemCompleted = useCallback(async (id: string, completed: boolean) => {
    if (!db) return;
    const originalItems = [...budgetItems];
    setBudgetItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
    try {
      await BudgetService.updateBudgetItem(db, id, { completed: !completed });
    } catch (error) {
      console.error('Failed to toggle budget item:', error);
      setBudgetItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update item completion status.',
        variant: 'destructive',
      });
    }
  }, [budgetItems, toast, db]);

  const cycleBudgetItems = useCallback(async (itemType: BudgetItemType) => {
    if (!db) return;
    try {
      await BudgetService.cycleBudgetItems(db, itemType);
      await fetchBudgetItems();
      toast({
        title: 'Success!',
        description: `${itemType} have been cycled for the next month.`,
      });
    } catch (error) {
      console.error(`Failed to cycle ${itemType}:`, error);
      toast({
        title: 'Error',
        description: `Could not cycle ${itemType}.`,
        variant: 'destructive',
      });
    }
  }, [fetchBudgetItems, toast, db]);

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
