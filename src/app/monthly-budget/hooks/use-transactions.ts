
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Transaction, AccountDetails } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useMonthlyBudget } from './use-monthly-budget';
import { useAccountDetails } from '@/hooks/use-transferees';
import { useBudget } from '@/app/budget/hooks/use-budget';
import { format } from 'date-fns';
import * as MonthlyBudgetService from '../services/monthly-budget-service';

export function useTransactions(month?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accountTransactions, setAccountTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const selectedMonth = month || format(new Date(), 'yyyy-MM');
  
  const { fetchBudget } = useMonthlyBudget(selectedMonth);
  const { accounts, fetchAccounts } = useAccountDetails();
  const { fetchBudgetItems } = useBudget(); // Import from useBudget

  const fetchTransactions = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedTransactions = await MonthlyBudgetService.getTransactionsForMonth(selectedMonth);
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
  }, [selectedMonth, toast]);

  const fetchTransactionsForAccount = useCallback(async (accountId: string) => {
    try {
        setIsLoading(true);
        const fetched = await MonthlyBudgetService.getTransactionsForAccount(accountId);
        setAccountTransactions(fetched);
    } catch (error) {
        console.error('Failed to load account transactions:', error);
         toast({
            title: 'Error',
            description: 'Failed to load transactions for this account.',
            variant: 'destructive',
        });
    } finally {
        setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchTransactions();
    fetchAccounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const addTransaction = useCallback(async (transactionData: Partial<Omit<Transaction, 'id'>>) => {
    await MonthlyBudgetService.addTransaction(transactionData);
    // Refetch all relevant data
    await Promise.all([fetchTransactions(), fetchBudget(), fetchAccounts(), fetchBudgetItems()]); 
  }, [fetchTransactions, fetchBudget, fetchAccounts, fetchBudgetItems]);

  const updateTransaction = useCallback(async (id: string, transactionData: Partial<Omit<Transaction, 'id'>>) => {
    await MonthlyBudgetService.updateTransaction(id, transactionData);
    await Promise.all([fetchTransactions(), fetchBudget(), fetchAccounts(), fetchBudgetItems()]); // Refetch all
  }, [fetchTransactions, fetchBudget, fetchAccounts, fetchBudgetItems]);

  const deleteTransaction = useCallback(async (id: string, accountId?: string) => {
    try {
      await MonthlyBudgetService.deleteTransaction(id);
      const refetchPromises = [
        fetchTransactions(),
        fetchBudget(),
        fetchAccounts(),
        fetchBudgetItems()
      ];
      if (accountId) {
        refetchPromises.push(fetchTransactionsForAccount(accountId));
      }
      await Promise.all(refetchPromises);
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete transaction.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchTransactions, fetchBudget, fetchAccounts, fetchBudgetItems, fetchTransactionsForAccount]);

  return { transactions, accountTransactions, accounts, addTransaction, updateTransaction, deleteTransaction, isLoading, fetchTransactions, fetchTransactionsForAccount };
}
