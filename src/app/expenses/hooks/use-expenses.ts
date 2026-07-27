'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Expense, MileageLog, Honorarium, UploadableFile } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as ExpenseService from '@/services/expense-service';
import * as MileageService from '@/services/mileage-service';
import { format } from 'date-fns';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [mileageLogs, setMileageLogs] = useState<MileageLog[]>([]);
  const [honorariums, setHonorariums] = useState<Honorarium[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      // Calling server actions - no 'db' argument needed
      const [fetchedExpenses, fetchedMileage, fetchedHonorariums] = await Promise.all([
        ExpenseService.getActiveMonetaryExpenses(),
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
        const archiveKey = format(new Date(), 'yyyy-MM');
        await ExpenseService.archiveCurrentExpenses(archiveKey);
        await ExpenseService.cycleExpensesToNextMonth();
        await fetchData();
        toast({
            title: 'Success!',
            description: 'Current month archived and next month\'s expenses are now active.',
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

  const addExpense = useCallback(async (
    itemData: Omit<Expense, 'id'>, 
    ledgerAccountId: string | undefined, 
    receiptFile: UploadableFile | undefined | null, 
    callback: (success: boolean) => void
  ) => {
    try {
      // Storage is now handled on the server or via a specialized server-side upload service
      await ExpenseService.addExpense(itemData, ledgerAccountId, receiptFile);
      await fetchData(); 
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
  }, [toast, fetchData]);

  const updateExpense = useCallback(async (id: string, itemData: Partial<Omit<Expense, 'id' | 'originalId'>>) => {
    try {
      await ExpenseService.updateExpense(id, itemData);
      await fetchData();
    } catch (error) {
      console.error('Failed to update expense:', error);
      toast({ title: 'Error', description: 'Failed to update the expense.', variant: 'destructive' });
    }
  }, [toast, fetchData]);

  const deleteExpense = useCallback(async (id: string) => {
    try {
      await ExpenseService.deleteExpense(id);
      await fetchData();
    } catch (error) {
      console.error('Failed to delete expense:', error);
      toast({ title: 'Error', description: 'Failed to delete the expense.', variant: 'destructive' });
    }
  }, [toast, fetchData]);

  const toggleExpenseCompleted = useCallback(async (id: string, completed: boolean) => {
    try {
      await ExpenseService.updateExpense(id, { completed: !completed });
      await fetchData();
    } catch (error) {
      console.error('Failed to toggle expense:', error);
      toast({ title: 'Error', description: 'Failed to update item status.', variant: 'destructive' });
    }
  }, [fetchData, toast]);

  // Mileage functions
  const addMileage = useCallback(async (itemData: Omit<MileageLog, 'id'>) => {
    try {
      await MileageService.addMileageLog(itemData);
      await fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add mileage log.', variant: 'destructive' });
    }
  }, [fetchData, toast]);

  const updateMileage = useCallback(async (id: string, itemData: Partial<Omit<MileageLog, 'id'>>) => {
    try {
      await MileageService.updateMileageLog(id, itemData);
      await fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update mileage log.', variant: 'destructive' });
    }
  }, [fetchData, toast]);

  const deleteMileage = useCallback(async (id: string) => {
    try {
      await MileageService.deleteMileageLog(id);
      await fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete mileage log.', variant: 'destructive' });
    }
  }, [fetchData, toast]);

  // Honorarium functions
  const addHonorarium = useCallback(async (itemData: Omit<Honorarium, 'id'>) => {
    try {
      await ExpenseService.addHonorarium(itemData);
      await fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to add honorarium.', variant: 'destructive' });
      throw error;
    }
  }, [fetchData, toast]);

  const updateHonorarium = useCallback(async (id: string, itemData: Partial<Omit<Honorarium, 'id'>>) => {
    try {
      await ExpenseService.updateHonorarium(id, itemData);
      await fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update honorarium.', variant: 'destructive' });
    }
  }, [fetchData, toast]);

  const deleteHonorarium = useCallback(async (id: string) => {
    try {
      await ExpenseService.deleteHonorarium(id);
      await fetchData();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete honorarium.', variant: 'destructive' });
      throw error;
    }
  }, [fetchData, toast]);

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