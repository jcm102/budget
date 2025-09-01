
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MonthlyBudgetItem, Category, BudgetSubItem } from '@/types';
import { useToast } from './use-toast';
import * as MonthlyBudgetService from '@/services/monthly-budget-service';
import * as BudgetCategoryService from '@/services/budget-category-service';

export function useMonthlyBudget() {
  const [budgetItems, setBudgetItems] = useState<MonthlyBudgetItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

  const fetchBudget = useCallback(async () => {
    try {
      setIsLoading(true);
      const [fetchedBudgetItems, fetchedCategories] = await Promise.all([
        MonthlyBudgetService.getBudgetForMonth(currentMonth),
        BudgetCategoryService.getCategories()
      ]);
      setBudgetItems(fetchedBudgetItems);
      setCategories(fetchedCategories);
    } catch (error) {
      console.error('Failed to load monthly budget data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load budget data from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, toast]);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  const updateBudgetItem = useCallback(async (categoryId: string, budgeted: number) => {
    try {
      const existingItem = budgetItems.find(item => item.categoryId === categoryId);
      if (existingItem) {
        await MonthlyBudgetService.updateBudgetItem(existingItem.id, { budgeted });
      } else {
        await MonthlyBudgetService.addBudgetItem({ categoryId, budgeted, month: currentMonth });
      }
      // Refetch to get the latest state
      await fetchBudget();
    } catch (error) {
      console.error('Failed to update budget item:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the budget amount.',
        variant: 'destructive',
      });
    }
  }, [budgetItems, currentMonth, toast, fetchBudget]);
  
  const updateBudgetItemWithBreakdown = useCallback(async (categoryId: string, breakdown: BudgetSubItem[]) => {
    try {
        const existingItem = budgetItems.find(item => item.categoryId === categoryId);
        const totalBudgeted = breakdown.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

        if (existingItem) {
            await MonthlyBudgetService.updateBudgetItem(existingItem.id, { budgeted: totalBudgeted, breakdown });
        } else {
            await MonthlyBudgetService.addBudgetItem({ categoryId, budgeted: totalBudgeted, month: currentMonth, breakdown });
        }
        await fetchBudget();
    } catch (error) {
         console.error('Failed to update budget breakdown:', error);
         toast({
            title: 'Error',
            description: 'Failed to update the budget breakdown.',
            variant: 'destructive',
        });
    }
  }, [budgetItems, currentMonth, toast, fetchBudget]);

  return { budgetItems, categories, updateBudgetItem, updateBudgetItemWithBreakdown, isLoading, fetchBudget };
}
