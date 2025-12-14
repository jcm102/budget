
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Expense, MileageLog, Honorarium, UploadableFile } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as ExpenseService from '../services/expense-service';
import * as MileageService from '../services/mileage-service';
import { format } from 'date-fns';
import { useFirestore } from '@/firebase';
import { getStorage } from 'firebase/storage';

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [mileageLogs, setMileageLogs] = useState<MileageLog[]>([]);
  const [honorariums, setHonorariums] = useState<Honorarium[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const db = useFirestore();
  const storage = getStorage();

  const fetchData = useCallback(async () => {
    if (!db) return;
    try {
      setIsLoading(true);
      const [fetchedExpenses, fetchedMileage, fetchedHonorariums] = await Promise.all([
        ExpenseService.getActiveMonetaryExpenses(db),
        MileageService.getMileageLogs(db, 'active'),
        ExpenseService.getHonorariums(db, 'active'),
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
  }, [toast, db]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const cycleExpensesToNextMonth = useCallback(async () => {
    try {
        const archiveKey = format(new Date(), 'yyyy-MM');
        await ExpenseService.archiveCurrentExpenses(db, archiveKey);
        await ExpenseService.cycleExpensesToNextMonth(db);
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
  }, [fetchData, toast, db]);

  const addExpense = useCallback(async (itemData: Omit<Expense, 'id'>, ledgerAccountId: string | undefined, receiptFile: UploadableFile | undefined | null, callback: (success: boolean) => void) => {
    try {
      await ExpenseService.addExpense(db, storage, itemData, ledgerAccountId, receiptFile);
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
  }, [toast, fetchData, db, storage]);

  const updateExpense = useCallback(async (id: string, itemData: Partial<Omit<Expense, 'id' | 'originalId'>>) => {
    try {
      await ExpenseService.updateExpense(db, id, itemData);
      await fetchData();
    } catch (error) {
      console.error('Failed to update expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the expense.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchData, db]);

  const deleteExpense = useCallback(async (id: string) => {
    try {
      await ExpenseService.deleteExpense(db, id);
      await fetchData();
    } catch (error) {
      console.error('Failed to delete expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the expense.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchData, db]);

  const toggleExpenseCompleted = useCallback(async (id: string, completed: boolean) => {
    try {
      await ExpenseService.updateExpense(db, id, { completed: !completed });
      await fetchData(); // Refetch to ensure UI is in sync with backend
    } catch (error) {
      console.error('Failed to toggle expense:', error);
      toast({
        title: 'Error',
        description: 'Failed to update item completion status.',
        variant: 'destructive',
      });
    }
  }, [fetchData, toast, db]);

  // Mileage functions
  const addMileage = useCallback(async (itemData: Omit<MileageLog, 'id'>) => {
    try {
      await MileageService.addMileageLog(db, itemData);
      await fetchData();
    } catch (error) {
      console.error('Failed to add mileage log:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new mileage log.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchData, db]);

  const updateMileage = useCallback(async (id: string, itemData: Partial<Omit<MileageLog, 'id'>>) => {
    try {
      await MileageService.updateMileageLog(db, id, itemData);
       await fetchData();
    } catch (error) {
      console.error('Failed to update mileage log:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the mileage log.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchData, db]);

  const deleteMileage = useCallback(async (id: string) => {
    try {
      await MileageService.deleteMileageLog(db, id);
       await fetchData();
    } catch (error) {
      console.error('Failed to delete mileage log:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the mileage log.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchData, db]);

  // Honorarium functions
  const addHonorarium = useCallback(async (itemData: Omit<Honorarium, 'id'>) => {
    try {
      await ExpenseService.addHonorarium(db, itemData);
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
  }, [toast, fetchData, db]);

  const updateHonorarium = useCallback(async (id: string, itemData: Partial<Omit<Honorarium, 'id'>>) => {
    try {
      await ExpenseService.updateHonorarium(db, id, itemData);
      await fetchData();
    } catch (error) {
      console.error('Failed to update honorarium:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the honorarium.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchData, db]);

  const deleteHonorarium = useCallback(async (id: string) => {
    try {
      await ExpenseService.deleteHonorarium(db, id);
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
  }, [toast, fetchData, db]);

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
