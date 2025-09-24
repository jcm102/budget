
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MonthlyBudgetItem, Category, BudgetSubItem } from '@/types';
import { useToast } from './use-toast';
import * as MonthlyBudgetService from '@/services/monthly-budget-service';
import * as BudgetCategoryService from '@/services/budget-category-service';
import { format, subMonths } from 'date-fns';

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
      const currentMonthDate = new Date(selectedMonth + '-02'); // Use day 2 to avoid timezone issues
      const previousMonthString = format(subMonths(currentMonthDate, 1), 'yyyy-MM');

      const [fetchedBudgetItems, fetchedPreviousBudgetItems, fetchedCategories] = await Promise.all([
        MonthlyBudgetService.getBudgetForMonth(selectedMonth),
        MonthlyBudgetService.getBudgetForMonth(previousMonthString),
        BudgetCategoryService.getCategories(),
      ]);
      setBudgetItems(fetchedBudgetItems);
      setPreviousMonthBudgetItems(fetchedPreviousBudgetItems);
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
  }, [selectedMonth, toast]);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  const updateBudgetItem = useCallback(async (categoryId: string, budgeted: number, breakdown?: BudgetSubItem[] | null) => {
    try {
      const existingItem = budgetItems.find(item => item.categoryId === categoryId);
      const itemData = {
        budgeted,
        breakdown: breakdown || null,
      };

      if (existingItem) {
        await MonthlyBudgetService.updateBudgetItem(existingItem.id, itemData);
      } else {
        await MonthlyBudgetService.addBudgetItem({ categoryId, month: selectedMonth, ...itemData });
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

  const copyCategoryFromPreviousMonth = useCallback(async (categoryId: string) => {
    const prevBudgetItem = previousMonthBudgetItems.find(item => item.categoryId === categoryId);
    if (prevBudgetItem) {
      await updateBudgetItem(categoryId, prevBudgetItem.budgeted, prevBudgetItem.breakdown);
      toast({
        title: 'Success',
        description: `Copied ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(prevBudgetItem.budgeted)} from previous month.`,
      });
    } else {
      toast({
        title: 'No Data',
        description: 'No budget amount found for this category in the previous month.',
        variant: 'destructive',
      });
    }
  }, [previousMonthBudgetItems, updateBudgetItem, toast]);

  const cycleToNextMonth = useCallback(async () => {
    try {
      await MonthlyBudgetService.cycleToNextMonth();
      await fetchBudget(); // Refetch data to show the cycled budget
      toast({
        title: 'Success!',
        description: 'Your budget has been cycled to the next month.',
      });
    } catch (error) {
      console.error('Failed to cycle budget:', error);
      toast({
        title: 'Error',
        description: 'Could not cycle the budget. Please try again.',
        variant: 'destructive',
      });
    }
  }, [fetchBudget, toast]);


  return { budgetItems, categories, updateBudgetItem, updateBudgetItemWithBreakdown, isLoading, fetchBudget, copyCategoryFromPreviousMonth, cycleToNextMonth };
}
