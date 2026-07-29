'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { Transaction, Category } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as MonthlyBudgetService from '@/app/monthly-budget/services/monthly-budget-service';
import { useAccountDetails } from '@/hooks/use-transferees';
import { getCategories } from '@/services/budget-category-service';

export function useTransactionLedger(startDate: string, endDate: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { accounts, fetchAccounts, isLoading: isLoadingAccounts } = useAccountDetails();
  const { toast } = useToast();
  const db = useFirestore();
  
  const isFetchingCats = useRef(false);

  // 1. Fetch Categories
  const fetchCategories = useCallback(async () => {
    if (isFetchingCats.current) return;
    try {
      isFetchingCats.current = true;
      const cats = await getCategories();
      setCategories(cats);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      isFetchingCats.current = false;
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // 2. Fetch Transactions within date range using real-time listener
  useEffect(() => {
    if (!db || !startDate || !endDate) return;

    setIsLoading(true);

    const q = query(
      collection(db, 'transactions'),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Transaction));
      setTransactions(items);
      setIsLoading(false);
    }, (error) => {
      console.error('Failed to listen to transactions:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, startDate, endDate]);

  // 3. Mutation wrappers
  const addTransaction = useCallback(async (transactionData: Partial<Omit<Transaction, 'id'>>) => {
    if (!db) return;
    try {
      await MonthlyBudgetService.addTransaction(db, transactionData);
      await fetchAccounts();
      toast({
        title: 'Success',
        description: 'Transaction added successfully.',
      });
    } catch (error) {
      console.error('Failed to add transaction:', error);
      toast({
        title: 'Error',
        description: 'Failed to add transaction.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [db, fetchAccounts, toast]);

  const updateTransaction = useCallback(async (id: string, transactionData: Partial<Omit<Transaction, 'id'>>) => {
    if (!db) return;
    try {
      await MonthlyBudgetService.updateTransaction(db, id, transactionData);
      await fetchAccounts();
      toast({
        title: 'Success',
        description: 'Transaction updated successfully.',
      });
    } catch (error) {
      console.error('Failed to update transaction:', error);
      toast({
        title: 'Error',
        description: 'Failed to update transaction.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [db, fetchAccounts, toast]);

  const deleteTransaction = useCallback(async (id: string) => {
    if (!db) return;
    try {
      await MonthlyBudgetService.deleteTransaction(db, id);
      await fetchAccounts();
      toast({
        title: 'Success',
        description: 'Transaction deleted successfully.',
      });
    } catch (error) {
      console.error('Failed to delete transaction:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete transaction.',
        variant: 'destructive',
      });
      throw error;
    }
  }, [db, fetchAccounts, toast]);

  return {
    transactions,
    accounts,
    categories,
    isLoading: isLoading || isLoadingAccounts,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  };
}
