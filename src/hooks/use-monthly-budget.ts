
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MonthlyBudgetItem, Category, BudgetSubItem } from '@/types';
import { useToast } from './use-toast';
import * as MonthlyBudgetService from '@/services/monthly-budget-service';
import * as BudgetCategoryService from '@/services/budget-category-service';
import { addMonths, format } from 'date-fns';

export function useMonthlyBudget(month?: string) {
  const [budgetItems, setBudgetItems] = useState<MonthlyBudgetItem[]>([]);
  const [previousMonthBudgetItems, setPreviousMonthBudgetItems] = useState<MonthlyBudgetItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  const selectedMonth = month || format(new Date(), 'yyyy-MM');

  const fetchBudget = useCallback(async () => {
    try {
      setIsLoading(true);
      const previousMonthDate = addMonths(new Date(selectedMonth), -1);
      const previousMonthString = format(previousMonthDate, 'yyyy-MM');

      const [fetchedBudgetItems, fetchedCategories, fetchedPreviousBudgetItems] = await Promise.all([
        MonthlyBudgetService.getBudgetForMonth(selectedMonth),
        BudgetCategoryService.getCategories(),
        MonthlyBudgetService.getBudgetForMonth(previousMonthString),
      ]);
      setBudgetItems(fetchedBudgetItems);
      setCategories(fetchedCategories);
      setPreviousMonthBudgetItems(fetchedPreviousBudgetItems);
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
  }, [selectedMonth, toast]);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  const updateBudgetItem = useCallback(async (categoryId: string, budgeted: number) => {
    try {
      const existingItem = budgetItems.find(item => item.categoryId === categoryId);
      if (existingItem) {
        await MonthlyBudgetService.updateBudgetItem(existingItem.id, { budgeted });
      } else {
        await MonthlyBudgetService.addBudgetItem({ categoryId, budgeted, month: selectedMonth });
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
  }, [budgetItems, selectedMonth, toast, fetchBudget]);
  
  const updateBudgetItemWithBreakdown = useCallback(async (categoryId: string, breakdown: BudgetSubItem[]) => {
    try {
        const existingItem = budgetItems.find(item => item.categoryId === categoryId);
        const totalBudgeted = breakdown.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

        if (existingItem) {
            await MonthlyBudgetService.updateBudgetItem(existingItem.id, { budgeted: totalBudgeted, breakdown });
        } else {
            await MonthlyBudgetService.addBudgetItem({ categoryId, budgeted: totalBudgeted, month: selectedMonth, breakdown });
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
  }, [budgetItems, selectedMonth, toast, fetchBudget]);

  const copyCategoryBudget = useCallback(async (categoryId: string) => {
    try {
        const prevBudgetItem = previousMonthBudgetItems.find(item => item.categoryId === categoryId);

        if (prevBudgetItem && prevBudgetItem.budgeted > 0) {
            await updateBudgetItem(categoryId, prevBudgetItem.budgeted);
        } else {
             toast({
                title: 'No Data',
                description: 'No budget amount found for this category in the previous month.',
            });
        }
    } catch (error) {
        console.error('Failed to copy category budget:', error);
        toast({
            title: 'Error',
            description: 'Could not copy the budget for this category.',
            variant: 'destructive',
        });
    }
  }, [previousMonthBudgetItems, toast, updateBudgetItem]);

  return { budgetItems, categories, updateBudgetItem, updateBudgetItemWithBreakdown, copyCategoryBudget, isLoading, fetchBudget };
}
