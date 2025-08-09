
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Expense, MileageLog } from '@/types';
import { useToast } from './use-toast';
import * as ExpenseService from '@/services/expense-service';
import * as MileageService from '@/services/mileage-service';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [mileageLogs, setMileageLogs] = useState<MileageLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchExpenses = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedItems = await ExpenseService.getExpenses('active');
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

  const fetchMileage = useCallback(async () => {
     try {
      setIsLoading(true);
      const fetchedItems = await MileageService.getMileageLogs('active');
      setMileageLogs(fetchedItems);
    } catch (error) {
      console.error('Failed to load mileage logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load mileage from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast])

  useEffect(() => {
    fetchExpenses();
    fetchMileage();
  }, [fetchExpenses, fetchMileage]);

  const addExpense = useCallback(async (itemData: Omit<Expense, 'id'>, callback: (success: boolean) => void) => {
    try {
      const newItem = await ExpenseService.addExpense(itemData);
      await fetchExpenses(); 
      callback(true);
    } catch (error) {
      console.error('Failed to add expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new expense.',
        variant: 'destructive',
      });
      callback(false);
    }
  }, [toast, fetchExpenses]);

  const updateExpense = useCallback(async (id: string, itemData: Partial<Omit<Expense, 'id' | 'originalId'>>) => {
    try {
      await ExpenseService.updateExpense(id, itemData);
      await fetchExpenses();
    } catch (error) {
      console.error('Failed to update expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the expense.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchExpenses]);

  const deleteExpense = useCallback(async (id: string) => {
    try {
      await ExpenseService.deleteExpense(id);
      await fetchExpenses(); // Refetch to ensure recurring items are handled correctly
    } catch (error) {
      console.error('Failed to delete expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the expense.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchExpenses]);

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

  return { expenses, mileageLogs, addExpense, updateExpense, deleteExpense, toggleExpenseCompleted, isLoading, fetchExpenses, fetchMileage };
}
