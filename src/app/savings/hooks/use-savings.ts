'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SavingsItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as SavingsService from '@/services/savings-service';
import { useSelectedAccount } from '@/hooks/use-selected-account';
import { initializeFirebase } from '@/firebase';

export function calculateMonthlyAmount(item: Omit<SavingsItem, 'monthlyAmount'>): number {
  if (item.isCustomGoal && item.goal != null) {
    return item.goal;
  }

  const totalCost = item.totalCost || 0;
  const amount = item.amount || 0;
  const remainingCost = Math.max(0, totalCost - amount);

  if (item.dueDate) {
    const today = new Date();
    const parts = item.dueDate.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dueDate = new Date(year, month, day);

      // Calculate months remaining including current month
      const yearDiff = dueDate.getFullYear() - today.getFullYear();
      const monthDiff = dueDate.getMonth() - today.getMonth();
      const monthsRemaining = yearDiff * 12 + monthDiff + 1;

      if (monthsRemaining > 0) {
        return remainingCost / monthsRemaining;
      }
    }
  }

  // If no due date or due date is in the past, fall back to recurrence
  if (item.recurrence) {
    switch (item.recurrence) {
      case 'Quarterly':
        return totalCost / 3;
      case 'Semi-Annually':
      case 'Semi-Annually (Custom)':
        return totalCost / 6;
      case 'Annually':
        return totalCost / 12;
      case 'Bi-Annually':
        return totalCost / 24;
      default:
        return 0;
    }
  }

  return 0;
}

export function useSavings() {
  const [savingsItems, setSavingsItems] = useState<SavingsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { selectedAccountId } = useSelectedAccount();
  
  const isFetching = useRef(false);

  const fetchAllData = useCallback(async (accountId: string | null) => {
    if (!accountId || isFetching.current) {
      if (!accountId) {
        setSavingsItems([]);
        setIsLoading(false);
      }
      return;
    }

    try {
      isFetching.current = true;
      setIsLoading(true);
      const fetchedItems = await SavingsService.getSavingsItems(accountId);
      const calculatedItems = fetchedItems.map(item => ({
        ...item,
        monthlyAmount: calculateMonthlyAmount(item)
      }));
      setSavingsItems(calculatedItems);
    } catch (error) {
      console.error('Failed to load savings data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load savings data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, [toast]);

  useEffect(() => {
    fetchAllData(selectedAccountId);
  }, [selectedAccountId, fetchAllData]);

  const getUserId = () => {
    const { auth } = initializeFirebase();
    return auth.currentUser?.uid;
  };

  const fundSinkingFund = async (fundId: string, amount: number) => {
    const userId = getUserId();
    if (!userId) return;
    try {
      await SavingsService.fundSinkingFund(fundId, amount, userId);
      await fetchAllData(selectedAccountId);
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const withdrawFromSinkingFund = async (fundId: string, amount: number) => {
    const userId = getUserId();
    if (!userId) return;
    try {
      await SavingsService.withdrawFromSinkingFund(fundId, amount, userId);
      await fetchAllData(selectedAccountId);
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const resetSinkingFund = async (fundId: string) => {
    try {
      await SavingsService.resetSinkingFund(fundId);
      await fetchAllData(selectedAccountId);
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const transferSinkingFund = async (fromFundId: string, toFundId: string, amount: number) => {
    try {
      await SavingsService.transferSinkingFund(fromFundId, toFundId, amount);
      await fetchAllData(selectedAccountId);
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  const addSavingsItem = async (itemData: Omit<SavingsItem, 'id' | 'monthlyAmount'>) => {
    try {
      await SavingsService.addSavingsItem(itemData);
      await fetchAllData(selectedAccountId);
      toast({ title: 'Success', description: 'Sinking fund added.' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to add sinking fund.', variant: 'destructive' });
    }
  };

  const updateSavingsItem = async (id: string, itemData: Partial<Omit<SavingsItem, 'id' | 'monthlyAmount'>>) => {
    try {
      await SavingsService.updateSavingsItem(id, itemData);
      await fetchAllData(selectedAccountId);
      toast({ title: 'Success', description: 'Sinking fund updated.' });
    } catch (error) {
      console.error(error);
      toast({ title: 'Error', description: 'Failed to update sinking fund.', variant: 'destructive' });
    }
  };

  const deleteSavingsItem = async (id: string) => {
    try {
      setSavingsItems(prev => prev.filter(item => item.id !== id));
      await SavingsService.deleteSavingsItem(id);
    } catch (error) {
      await fetchAllData(selectedAccountId);
      toast({ title: 'Error', description: 'Failed to delete fund.', variant: 'destructive' });
    }
  };

  return { 
    savingsItems, 
    isLoading, 
    addSavingsItem,
    updateSavingsItem,
    deleteSavingsItem,
    fundSinkingFund,
    withdrawFromSinkingFund,
    resetSinkingFund,
    transferSinkingFund,
    fetchSavingsItems: () => fetchAllData(selectedAccountId)
  };
}