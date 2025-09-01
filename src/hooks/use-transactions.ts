
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Transaction } from '@/types';
import { useToast } from './use-toast';
import * as MonthlyBudgetService from '@/services/monthly-budget-service';

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

  const fetchTransactions = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedTransactions = await MonthlyBudgetService.getTransactionsForMonth(currentMonth);
      setTransactions(fetchedTransactions);
    } catch (error) {
      console.error('Failed to load transactions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load transactions from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, toast]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const addTransaction = useCallback(async (transactionData: Omit<Transaction, 'id'>) => {
    try {
      await MonthlyBudgetService.addTransaction(transactionData);
      await fetchTransactions(); // refetch to get the latest list
    } catch (error) {
      console.error('Failed to add transaction:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new transaction.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchTransactions]);

  return { transactions, addTransaction, isLoading, fetchTransactions };
}
