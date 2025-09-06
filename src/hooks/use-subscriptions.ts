
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SubscriptionItem } from '@/types';
import { useToast } from './use-toast';
import * as SubscriptionService from '@/services/subscription-service';
import { useSelectedAccount } from './use-selected-account';
import { useMonthlyBudget } from './use-monthly-budget';

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { selectedAccountId } = useSelectedAccount();
  const { fetchBudget } = useMonthlyBudget();

  const fetchSubscriptions = useCallback(async (accountId: string | null) => {
    if (!accountId) {
      setSubscriptions([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const fetchedItems = await SubscriptionService.getSubscriptions(accountId);
      setSubscriptions(fetchedItems);
    } catch (error) {
      console.error('Failed to load subscriptions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load subscriptions from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSubscriptions(selectedAccountId);
  }, [selectedAccountId, fetchSubscriptions]);

  const addSubscription = useCallback(async (itemData: Omit<SubscriptionItem, 'id'>) => {
    try {
      await SubscriptionService.addSubscription(itemData);
      await fetchSubscriptions(selectedAccountId);
      await fetchBudget(); // Refetch budget to see changes
    } catch (error) {
      console.error('Failed to add subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new subscription.',
        variant: 'destructive',
      });
    }
  }, [toast, selectedAccountId, fetchSubscriptions, fetchBudget]);

  const updateSubscription = useCallback(async (id: string, itemData: Partial<Omit<SubscriptionItem, 'id'>>) => {
    try {
      await SubscriptionService.updateSubscription(id, itemData);
      await fetchSubscriptions(selectedAccountId);
      await fetchBudget(); // Refetch budget to see changes
    } catch (error) {
      console.error('Failed to update subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the subscription.',
        variant: 'destructive',
      });
    }
  }, [toast, selectedAccountId, fetchSubscriptions, fetchBudget]);

  const deleteSubscription = useCallback(async (id: string) => {
    try {
      await SubscriptionService.deleteSubscription(id);
      await fetchSubscriptions(selectedAccountId);
      await fetchBudget(); // Refetch budget to see changes
    } catch (error) {
      console.error('Failed to delete subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the subscription.',
        variant: 'destructive',
      });
    }
  }, [toast, selectedAccountId, fetchSubscriptions, fetchBudget]);

  return { subscriptions, isLoading, addSubscription, updateSubscription, deleteSubscription, fetchSubscriptions: () => fetchSubscriptions(selectedAccountId) };
}
