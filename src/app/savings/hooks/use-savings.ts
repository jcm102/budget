

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SavingsItem, SubscriptionItem, AutoShipItem } from '@/types';
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
    if (!user) return;
    try {
      // The service now returns the new item with the monthlyAmount calculated
      const newItem = await SavingsService.addSavingsItem(user.uid, itemData);
      setSavingsItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Failed to add savings item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new fund.',
        variant: 'destructive',
      });
    }
  }, [toast, user]);

  const updateSavingsItem = useCallback(async (id: string, itemData: Partial<Omit<SavingsItem, 'id' | 'monthlyAmount'>>) => {
    if (!user) return;
    try {
      await SavingsService.updateSavingsItem(user.uid, id, itemData);
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
  }, [toast, selectedAccountId, fetchAllData, user]);

  const deleteSavingsItem = useCallback(async (id: string) => {
    if (!user) return;
    const originalItems = savingsItems;
    setSavingsItems(prev => prev.filter(item => item.id !== id));
    try {
      await SavingsService.deleteSavingsItem(user.uid, id);
    } catch (error) {
      console.error('Failed to delete savings item:', error);
      setSavingsItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to delete the fund.',
        variant: 'destructive',
      });
    }
  }, [savingsItems, toast, user]);

  return { 
    savingsItems, 
    isLoading, 
    addSavingsItem, 
    updateSavingsItem, 
    deleteSavingsItem, 
    fetchSavingsItems: () => fetchAllData(selectedAccountId)
  };
}
