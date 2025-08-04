
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Expense } from '@/types';
import { useToast } from './use-toast';
import * as ExpenseService from '@/services/expense-service';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchExpenses = async () => {
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
    };
    fetchExpenses();
  }, [toast]);

  const addExpense = useCallback(async (itemData: Omit<Expense, 'id'>) => {
    try {
      const newItem = await ExpenseService.addExpense(itemData);
      setExpenses((prev) => [...prev, newItem].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error('Failed to add expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new expense.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const updateExpense = useCallback(async (id: string, itemData: Omit<Expense, 'id'>) => {
    const originalItems = expenses;
    setExpenses((prev) =>
      prev.map((item) => (item.id === id ? { id, ...itemData } : item))
         .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    );
    try {
      await ExpenseService.updateExpense(id, itemData);
    } catch (error) {
      console.error('Failed to update expense:', error);
      setExpenses(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update the expense.',
        variant: 'destructive',
      });
    }
  }, [expenses, toast]);

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

  return { expenses, addExpense, updateExpense, deleteExpense, isLoading };
}
