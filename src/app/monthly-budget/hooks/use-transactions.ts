
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Transaction, AccountDetails } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useMonthlyBudget } from './use-monthly-budget';
import { useAccountDetails } from '@/hooks/use-transferees';
import { useBudget } from '@/app/budget/hooks/use-budget';
import { format } from 'date-fns';
import * as MonthlyBudgetService from '../services/monthly-budget-service';
import { useFirestore } from '@/firebase';

export function useTransactions(month?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accountTransactions, setAccountTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const db = useFirestore();

  const selectedMonth = month || format(new Date(), 'yyyy-MM');
  
  useMonthlyBudget(selectedMonth);
  const { accounts, fetchAccounts } = useAccountDetails();
  const { fetchBudgetItems } = useBudget(selectedMonth); // Import from useBudget

  const fetchTransactions = useCallback(async () => {
    if (!db) return;
    try {
      setIsLoading(true);
      const fetchedTransactions = await MonthlyBudgetService.getTransactionsForMonth(db, selectedMonth);
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
  }, [selectedMonth, toast, db]);

  const fetchTransactionsForAccount = useCallback(async (accountId: string) => {
    if (!db) return;
    try {
        setIsLoading(true);
        const fetched = await MonthlyBudgetService.getTransactionsForAccount(db, accountId);
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
  }, [toast, db]);

  useEffect(() => {
    fetchTransactions();
    fetchAccounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const addTransaction = useCallback(async (transactionData: Partial<Omit<Transaction, 'id'>>) => {
    if (!db) return;
    await MonthlyBudgetService.addTransaction(db, transactionData);
    // Refetch all relevant data
    await Promise.all([fetchTransactions(), fetchAccounts(), fetchBudgetItems()]); 
  }, [fetchTransactions, fetchAccounts, fetchBudgetItems, db]);

  const updateTransaction = useCallback(async (id: string, transactionData: Partial<Omit<Transaction, 'id'>>) => {
    if (!db) return;
    await MonthlyBudgetService.updateTransaction(db, id, transactionData);
    await Promise.all([fetchTransactions(), fetchAccounts(), fetchBudgetItems()]); // Refetch all
  }, [fetchTransactions, fetchAccounts, fetchBudgetItems, db]);

  const deleteTransaction = useCallback(async (id: string, accountId?: string) => {
    if (!db) return;
    try {
      await MonthlyBudgetService.deleteTransaction(db, id);
      const refetchPromises = [
        fetchTransactions(),
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
  }, [toast, fetchTransactions, fetchAccounts, fetchBudgetItems, fetchTransactionsForAccount, db]);

  return { transactions, accountTransactions, accounts, addTransaction, updateTransaction, deleteTransaction, isLoading, fetchTransactions, fetchTransactionsForAccount };
}
