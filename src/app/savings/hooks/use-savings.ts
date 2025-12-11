
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SavingsItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as SavingsService from '@/services/savings-service';
import { useSelectedAccount } from '@/hooks/use-selected-account';
import { useUser } from '@/firebase';


export function useSavings() {
  const [savingsItems, setSavingsItems] = useState<SavingsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { selectedAccountId } = useSelectedAccount();
  const { user } = useUser();

  const fetchAllData = useCallback(async (accountId: string | null) => {
    if (!accountId) {
      setSavingsItems([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      // Fetch all data from the service, which now includes the calculated monthlyAmount
      const fetchedItems = await SavingsService.getSavingsItems(accountId);
      setSavingsItems(fetchedItems);
    } catch (error) {
      console.error('Failed to load savings-related data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load savings data from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAllData(selectedAccountId);
  }, [selectedAccountId, fetchAllData]);

  const addSavingsItem = useCallback(async (itemData: Omit<SavingsItem, 'id' | 'monthlyAmount'>) => {
    try {
      // The service now returns the new item with the monthlyAmount calculated
      const newItem = await SavingsService.addSavingsItem(itemData);
      setSavingsItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Failed to add savings item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new fund.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const updateSavingsItem = useCallback(async (id: string, itemData: Partial<Omit<SavingsItem, 'id' | 'monthlyAmount'>>) => {
    try {
      await SavingsService.updateSavingsItem(id, itemData);
      // After any update, refetch everything to get recalculated values
      await fetchAllData(selectedAccountId);
    } catch (error) {
      console.error('Failed to update savings item:', error);
      // No need for optimistic reversal, fetch will get the correct state
      toast({
        title: 'Error',
        description: 'Failed to update the fund.',
        variant: 'destructive',
      });
    }
  }, [toast, selectedAccountId, fetchAllData]);

  const fundSinkingFund = useCallback(async (fundId: string, amount: number, userId: string) => {
    try {
      await SavingsService.fundSinkingFund(fundId, amount, userId);
      // Refetch data to update the UI
      await fetchAllData(selectedAccountId);
    } catch (error) {
      console.error('Failed to fund sinking fund:', error);
      // The service will throw, so we can re-throw to be caught in the component
      throw error;
    }
  }, [selectedAccountId, fetchAllData]);
  
  const withdrawFromSinkingFund = useCallback(async (fundId: string, amount: number, userId: string) => {
    try {
      await SavingsService.withdrawFromSinkingFund(fundId, amount, userId);
      await fetchAllData(selectedAccountId);
    } catch (error) {
      console.error('Failed to withdraw from sinking fund:', error);
      throw error;
    }
  }, [selectedAccountId, fetchAllData]);


  const deleteSavingsItem = useCallback(async (id: string) => {
    const originalItems = savingsItems;
    setSavingsItems(prev => prev.filter(item => item.id !== id));
    try {
      await SavingsService.deleteSavingsItem(id);
    } catch (error) {
      console.error('Failed to delete savings item:', error);
      setSavingsItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to delete the fund.',
        variant: 'destructive',
      });
    }
  }, [savingsItems, toast]);

  return { 
    savingsItems, 
    isLoading, 
    addSavingsItem, 
    updateSavingsItem, 
    deleteSavingsItem,
    fundSinkingFund,
    withdrawFromSinkingFund, 
    fetchSavingsItems: () => fetchAllData(selectedAccountId)
  };
}
