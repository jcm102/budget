'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BudgetItem, BudgetItemType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as BudgetService from '@/app/budget/services/budget-service';
import * as DebtService from '@/app/debt/services/debt-service';
import { useAccountDetails } from '@/hooks/use-transferees';
import { useFirestore } from '@/firebase';
import { format, addMonths, parse } from 'date-fns';

export function useBudget(selectedMonth: string = format(new Date(), 'yyyy-MM'), onMutation?: () => void) {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { fetchAccounts } = useAccountDetails();
  const db = useFirestore();

  const fetchBudgetItems = useCallback(async () => {
      if (!db) return;
      try {
        setIsLoading(true);
        // Load regular budget items relative to the selected month
        const fetchedItems = await BudgetService.getBudgetItems(db, selectedMonth);
        const regularItems = fetchedItems.filter(item => item.type !== 'Debt Payments');

        // Fetch current and next month's debts dynamically relative to selected month
        const currentMonth = selectedMonth;
        const nextMonth = format(addMonths(parse(selectedMonth + '-01', 'yyyy-MM-dd', new Date()), 1), 'yyyy-MM');
        
        const [currentDebts, nextDebts] = await Promise.all([
          DebtService.getDebts(currentMonth),
          DebtService.getDebts(nextMonth)
        ]);

        const virtualDebtItems: BudgetItem[] = [];
        
        currentDebts.forEach(debt => {
          if (debt.archived && (debt.balance || 0) <= 0) return;
          virtualDebtItems.push({
            id: `virtual-debt-current-${debt.id}`,
            type: 'Debt Payments',
            category: 'N/A',
            description: debt.name,
            amount: debt.plannedPayment || 0,
            date: debt.dueDate || `${currentMonth}-01`,
            frequency: 'One-Time',
            completed: debt.paid || false,
            forNextMonth: false,
            isVirtual: true,
            debtId: debt.id
          } as any);
        });

        nextDebts.forEach(debt => {
          if (debt.archived && (debt.balance || 0) <= 0) return;
          virtualDebtItems.push({
            id: `virtual-debt-next-${debt.id}`,
            type: 'Debt Payments',
            category: 'N/A',
            description: debt.name,
            amount: debt.minimumPayment || 0,
            date: debt.dueDate || `${nextMonth}-01`,
            frequency: 'One-Time',
            completed: false,
            forNextMonth: true,
            isVirtual: true,
            debtId: debt.id
          } as any);
        });

        setBudgetItems([...regularItems, ...virtualDebtItems]);
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
    }, [toast, db, selectedMonth]);

  useEffect(() => {
    fetchBudgetItems();
  }, [fetchBudgetItems]);

  const addBudgetItem = useCallback(async (itemData: Omit<BudgetItem, 'id'>) => {
    if (!db) return;
    try {
      await BudgetService.addBudgetItem(db, itemData);
      await fetchBudgetItems();
      if (itemData.type === 'Income' || itemData.type === 'Transfers') {
        await fetchAccounts();
      }
      onMutation?.();
    } catch (error) {
      console.error('Failed to add budget item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new budget item.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchAccounts, fetchBudgetItems, db, onMutation]);

  const updateBudgetItem = useCallback(async (id: string, itemData: Partial<Omit<BudgetItem, 'id' | 'originalId'>>, updateType?: 'instance' | 'pattern') => {
    if (!db) return;
    try {
      await BudgetService.updateBudgetItem(db, id, itemData, updateType);
      await fetchBudgetItems();
      if (itemData.type === 'Income' || itemData.type === 'Transfers') {
        await fetchAccounts();
      }
      onMutation?.();
    } catch (error) {
      console.error('Failed to update budget item:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the budget item.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchAccounts, fetchBudgetItems, db, onMutation]);

  const deleteBudgetItem = useCallback(async (id: string, deleteType?: 'instance' | 'pattern') => {
    if (!db) return;
    try {
      await BudgetService.deleteBudgetItem(db, id, deleteType);
      await fetchBudgetItems();
      onMutation?.();
    } catch (error) {
      console.error('Failed to delete budget item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the budget item.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchBudgetItems, db, onMutation]);

  const toggleBudgetItemCompleted = useCallback(async (id: string, completed: boolean) => {
    if (id.startsWith('virtual-debt-')) {
      const parts = id.split('-');
      const forNextMonth = parts[2] === 'next';
      const debtId = parts.slice(3).join('-');
      
      const month = forNextMonth 
        ? format(addMonths(parse(selectedMonth + '-01', 'yyyy-MM-dd', new Date()), 1), 'yyyy-MM')
        : selectedMonth;
        
      try {
        await DebtService.updateDebt(debtId, month, { paid: !completed });
        await fetchBudgetItems();
        onMutation?.();
      } catch (error) {
        console.error('Failed to toggle virtual debt:', error);
        toast({
          title: 'Error',
          description: 'Failed to update item completion status.',
          variant: 'destructive',
        });
      }
      return;
    }

    if (!db) return;
    const originalItems = [...budgetItems];
    setBudgetItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
    try {
      await BudgetService.updateBudgetItem(db, id, { completed: !completed });
      onMutation?.();
    } catch (error) {
      console.error('Failed to toggle budget item:', error);
      setBudgetItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update item completion status.',
        variant: 'destructive',
      });
    }
  }, [budgetItems, toast, db, fetchBudgetItems, selectedMonth, onMutation]);

  const cycleBudgetItems = useCallback(async (itemType: BudgetItemType) => {
    if (!db) return;
    try {
      await BudgetService.cycleBudgetItems(db, itemType);
      await fetchBudgetItems();
      onMutation?.();
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
  }, [fetchBudgetItems, toast, db, onMutation]);

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
