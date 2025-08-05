
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Expense } from '@/types';
import { useToast } from './use-toast';
import * as ExpenseService from '@/services/expense-service';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchExpenses = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedItems = await ExpenseService.getExpenses();
      setExpenses(fetchedItems);
    } catch (error) {
      console.error('Failed to load expenses:', error);
      toast({
        title: 'Error',
        description: 'Failed to load expenses from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const addExpense = useCallback(async (itemData: Omit<Expense, 'id'>) => {
    try {
      await ExpenseService.addExpense(itemData);
      await fetchExpenses();
    } catch (error) {
      console.error('Failed to add expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new expense.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchExpenses]);

  const updateExpense = useCallback(async (id: string, itemData: Partial<Omit<Expense, 'id' | 'originalId'>>) => {
    const originalItems = expenses;
    const isRecurringInstance = id.includes('-');
    if (isRecurringInstance) {
        setExpenses(prev => prev.filter(item => item.id !== id));
    } else {
        setExpenses((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...itemData } as Expense : item))
        );
    }
    
    try {
      await ExpenseService.updateExpense(id, itemData);
      await fetchExpenses();
    } catch (error) {
      console.error('Failed to update expense:', error);
      setExpenses(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update the expense.',
        variant: 'destructive',
      });
    }
  }, [expenses, toast, fetchExpenses]);

  const deleteExpense = useCallback(async (id: string) => {
    const originalItems = expenses;
    setExpenses((prev) => prev.filter((item) => item.id !== id));
    try {
      await ExpenseService.deleteExpense(id);
    } catch (error) {
      console.error('Failed to delete expense:', error);
      setExpenses(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to delete the expense.',
        variant: 'destructive',
      });
    }
  }, [expenses, toast]);

  const toggleExpenseCompleted = useCallback(async (id: string, completed: boolean) => {
    const originalItems = [...expenses];
    setExpenses(prev =>
      prev.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
    try {
      await ExpenseService.updateExpense(id, { completed: !completed });
    } catch (error) {
      console.error('Failed to toggle expense:', error);
      setExpenses(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update item completion status.',
        variant: 'destructive',
      });
    }
  }, [expenses, toast]);

  return { expenses, addExpense, updateExpense, deleteExpense, toggleExpenseCompleted, isLoading, fetchExpenses };
}
