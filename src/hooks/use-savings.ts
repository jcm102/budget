
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SavingsItem } from '@/types';
import { useToast } from './use-toast';
import * as SavingsService from '@/services/savings-service';
import { useSelectedAccount } from './use-selected-account';
import { useUser, useFirestore } from '@/firebase';


export function useSavings() {
  const [savingsItems, setSavingsItems] = useState<SavingsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { selectedAccountId } = useSelectedAccount();
  const { user } = useUser();
  const db = useFirestore();

  const fetchAllData = useCallback(async (accountId: string | null) => {
    if (!db || !accountId) {
      setSavingsItems([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      // Fetch all data from the service, which now includes the calculated monthlyAmount
      const fetchedItems = await SavingsService.getSavingsItems(db, accountId);
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
  }, [toast, db]);

  useEffect(() => {
    fetchAllData(selectedAccountId);
  }, [selectedAccountId, fetchAllData]);

  const addSavingsItem = useCallback(async (itemData: Omit<SavingsItem, 'id' | 'monthlyAmount'>) => {
    if (!db) return;
    try {
      // The service now returns the new item with the monthlyAmount calculated
      const newItem = await SavingsService.addSavingsItem(db, itemData);
      setSavingsItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Failed to add savings item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new fund.',
        variant: 'destructive',
      });
    }
  }, [toast, db]);

  const updateSavingsItem = useCallback(async (id: string, itemData: Partial<Omit<SavingsItem, 'id' | 'monthlyAmount'>>) => {
    if (!db) return;
    try {
      await SavingsService.updateSavingsItem(db, id, itemData);
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
  }, [toast, selectedAccountId, fetchAllData, db]);

  const fundSinkingFund = useCallback(async (fundId: string, amount: number, userId: string) => {
    if (!db) return;
    try {
      await SavingsService.fundSinkingFund(db, fundId, amount, userId);
      // Refetch data to update the UI
      await fetchAllData(selectedAccountId);
    } catch (error) {
      console.error('Failed to fund sinking fund:', error);
      // The service will throw, so we can re-throw to be caught in the component
      throw error;
    }
  }, [selectedAccountId, fetchAllData, db]);
  
  const withdrawFromSinkingFund = useCallback(async (fundId: string, amount: number, userId: string) => {
    if (!db) return;
    try {
      await SavingsService.withdrawFromSinkingFund(db, fundId, amount, userId);
      await fetchAllData(selectedAccountId);
    } catch (error) {
      console.error('Failed to withdraw from sinking fund:', error);
      throw error;
    }
  }, [selectedAccountId, fetchAllData, db]);

  const resetSinkingFund = useCallback(async (fundId: string, userId: string) => {
    if (!db) return;
    try {
        await SavingsService.resetSinkingFund(db, fundId, userId);
        await fetchAllData(selectedAccountId);
    } catch (error) {
        console.error('Failed to reset sinking fund:', error);
        throw error;
    }
  }, [selectedAccountId, fetchAllData, db]);
  
  const transferSinkingFund = useCallback(async (fromFundId: string, toFundId: string, amount: number, userId: string) => {
      if (!db) return;
      try {
        await SavingsService.transferSinkingFund(db, fromFundId, toFundId, amount, userId);
        await fetchAllData(selectedAccountId);
      } catch (error) {
        console.error('Failed to transfer sinking funds:', error);
        throw error;
      }
  }, [selectedAccountId, fetchAllData, db]);


  const deleteSavingsItem = useCallback(async (id: string) => {
    if (!db) return;
    const originalItems = savingsItems;
    setSavingsItems(prev => prev.filter(item => item.id !== id));
    try {
      await SavingsService.deleteSavingsItem(db, id);
    } catch (error) {
      console.error('Failed to delete savings item:', error);
      setSavingsItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to delete the fund.',
        variant: 'destructive',
      });
    }
  }, [savingsItems, toast, db]);

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
