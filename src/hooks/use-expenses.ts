
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Expense, MileageLog, Honorarium } from '@/types';
import { useToast } from './use-toast';
import * as ExpenseService from '@/services/expense-service';
import * as MileageService from '@/services/mileage-service';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [mileageLogs, setMileageLogs] = useState<MileageLog[]>([]);
  const [honorariums, setHonorariums] = useState<Honorarium[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [fetchedExpenses, fetchedMileage, fetchedHonorariums] = await Promise.all([
        ExpenseService.getExpenses('active'),
        MileageService.getMileageLogs('active'),
        ExpenseService.getHonorariums('active'),
      ]);
      setExpenses(fetchedExpenses);
      setMileageLogs(fetchedMileage);
      setHonorariums(fetchedHonorariums);
    } catch (error) {
      console.error('Failed to load expense data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load expense data from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const cycleExpensesToNextMonth = useCallback(async () => {
    try {
        await ExpenseService.cycleExpensesToNextMonth();
        await fetchData();
        toast({
            title: 'Success!',
            description: 'Next month\'s expenses have been moved to the current month.',
        });
    } catch (error) {
        console.error('Failed to cycle expenses:', error);
        toast({
            title: 'Error',
            description: 'Could not cycle expenses to the next month.',
            variant: 'destructive',
        });
    }
  }, [fetchData, toast]);

  const addExpense = useCallback(async (itemData: Omit<Expense, 'id'>, ledgerAccountId: string | undefined, callback: (success: boolean) => void) => {
    try {
      await ExpenseService.addExpense(itemData, ledgerAccountId);
      await fetchData(); 
      callback(true);
    } catch (error) {
      console.error('Failed to add expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new expense and update the fund.',
        variant: 'destructive',
      });
      callback(false);
    }
  }, [toast, fetchData]);

  const updateExpense = useCallback(async (id: string, itemData: Partial<Omit<Expense, 'id' | 'originalId'>>) => {
    try {
      await ExpenseService.updateExpense(id, itemData);
      await fetchData();
    } catch (error) {
      console.error('Failed to update expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the expense.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchData]);

  const deleteExpense = useCallback(async (id: string) => {
    try {
      await ExpenseService.deleteExpense(id);
      await fetchData();
    } catch (error) {
      console.error('Failed to delete expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the expense.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchData]);

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

  // Mileage functions
  const addMileage = useCallback(async (itemData: Omit<MileageLog, 'id'>) => {
    try {
      await MileageService.addMileageLog(itemData);
      await fetchData();
    } catch (error) {
      console.error('Failed to add mileage log:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new mileage log.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchData]);

  const updateMileage = useCallback(async (id: string, itemData: Omit<MileageLog, 'id'>) => {
    try {
      await MileageService.updateMileageLog(id, itemData);
       await fetchData();
    } catch (error) {
      console.error('Failed to update mileage log:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the mileage log.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchData]);

  const deleteMileage = useCallback(async (id: string) => {
    try {
      await MileageService.deleteMileageLog(id);
       await fetchData();
    } catch (error) {
      console.error('Failed to delete mileage log:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the mileage log.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchData]);

  // Honorarium functions
  const addHonorarium = useCallback(async (itemData: Omit<Honorarium, 'id'>) => {
    try {
      await ExpenseService.addHonorarium(itemData);
      await fetchData();
    } catch (error) {
      console.error('Failed to add honorarium:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new honorarium.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [toast, fetchData]);

  const updateHonorarium = useCallback(async (id: string, itemData: Partial<Omit<Honorarium, 'id'>>) => {
    try {
      await ExpenseService.updateHonorarium(id, itemData);
      await fetchData();
    } catch (error) {
      console.error('Failed to update honorarium:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the honorarium.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchData]);

  const deleteHonorarium = useCallback(async (id: string) => {
    try {
      await ExpenseService.deleteHonorarium(id);
      await fetchData();
    } catch (error) {
      console.error('Failed to delete honorarium:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the honorarium.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [toast, fetchData]);

  return { 
    expenses, 
    mileageLogs, 
    honorariums,
    addExpense, 
    updateExpense, 
    deleteExpense, 
    toggleExpenseCompleted, 
    addMileage,
    updateMileage,
    deleteMileage,
    addHonorarium,
    updateHonorarium,
    deleteHonorarium,
    isLoading, 
    fetchData,
    cycleExpensesToNextMonth,
  };
}
