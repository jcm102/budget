'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { SavingsItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as SavingsService from '@/services/savings-service';
import { useSelectedAccount } from '@/hooks/use-selected-account';
import { initializeFirebase } from '@/firebase';

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
      setSavingsItems(fetchedItems);
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
    const userId = getUserId();
    if (!userId) return;
    try {
      await SavingsService.transferSinkingFund(fromFundId, toFundId, amount, userId);
      await fetchAllData(selectedAccountId);
    } catch (error) {
      console.error(error);
      throw error;
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
    deleteSavingsItem,
    fundSinkingFund,
    withdrawFromSinkingFund,
    resetSinkingFund,
    transferSinkingFund,
    fetchSavingsItems: () => fetchAllData(selectedAccountId)
  };
}