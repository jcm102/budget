'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SavingsItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as SavingsService from '@/services/savings-service';
import { useSelectedAccount } from '@/hooks/use-selected-account';
import { initializeFirebase } from '@/firebase';

export function getExchangeRateForItem(item: SavingsItem, currentRate: number | null): number {
  if (item.currency !== 'USD') return 1;
  if (item.exchangeRateType === '5year') return 1.3344;
  if (item.exchangeRateType === '10year') return 1.3260;
  return currentRate || 1.35;
}

export function getActiveCycle(item: Omit<SavingsItem, 'monthlyAmount'>, referenceDate?: Date) {
  const currentCycle = {
    dueDate: item.dueDate,
    totalCost: item.totalCost || 0,
    goal: item.goal || 0,
  };

  if (!item.previousCycles || item.previousCycles.length === 0) {
    return currentCycle;
  }

  const allCycles = [...item.previousCycles, currentCycle].filter(c => c.dueDate);
  allCycles.sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());

  const today = referenceDate ?? new Date();
  
  for (const cycle of allCycles) {
    if (cycle.dueDate) {
      const parts = cycle.dueDate.split('T')[0].split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const dueDateObj = new Date(year, month, day);

        const yearDiff = dueDateObj.getFullYear() - today.getFullYear();
        const monthDiff = dueDateObj.getMonth() - today.getMonth();
        const monthsRemaining = yearDiff * 12 + monthDiff;

        if (monthsRemaining > 0) {
          return cycle;
        }
      }
    }
  }

  return currentCycle;
}

export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return new Date(dateStr);
}

export function calculateMonthlyAmount(item: Omit<SavingsItem, 'monthlyAmount'>, referenceDate?: Date): number {
  if (item.status === 'inactive') {
    return 0;
  }

  const activeCycle = getActiveCycle(item, referenceDate);
  const isCustomGoal = item.isCustomGoal;

  if (isCustomGoal && activeCycle.goal != null) {
    return activeCycle.goal;
  }

  const totalCost = activeCycle.totalCost || 0;

  if (activeCycle.dueDate) {
    const startRefDate = item.activatedAt ? parseLocalDate(item.activatedAt) : (referenceDate ?? new Date());
    const parts = activeCycle.dueDate.split('T')[0].split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dueDate = new Date(year, month, day);

      // Months to save: from the active reference month up to (and including) the month
      // BEFORE the due month, so the full amount is ready at the START of the due month.
      const yearDiff = dueDate.getFullYear() - startRefDate.getFullYear();
      const monthDiff = dueDate.getMonth() - startRefDate.getMonth();
      const monthsRemaining = yearDiff * 12 + monthDiff;

      if (monthsRemaining > 0) {
        // Static planned rate — always based on totalCost and active timeline.
        return totalCost / monthsRemaining;
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

  return item.goal ?? 0;
}


export function useSavings() {
  const [savingsItems, setSavingsItems] = useState<SavingsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { selectedAccountId } = useSelectedAccount();
  
  const isFetching = useRef(false);

  const fetchAllData = useCallback(async (accountId: string | null) => {
    const targetAccountId = (!accountId || accountId === '' || accountId === 'null') ? 'all' : accountId;
    if (isFetching.current) return;

    try {
      isFetching.current = true;
      setIsLoading(true);
      const fetchedItems = await SavingsService.getSavingsItems(targetAccountId);
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