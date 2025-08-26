
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SubscriptionItem } from '@/types';
import { useToast } from './use-toast';
import * as SubscriptionService from '@/services/subscription-service';
import { useSelectedAccount } from './use-selected-account';

export function useSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { selectedAccountId } = useSelectedAccount();

  const fetchSubscriptions = useCallback(async () => {
    if (!selectedAccountId) {
      setSubscriptions([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const fetchedItems = await SubscriptionService.getSubscriptions(selectedAccountId);
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
  }, [toast, selectedAccountId]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const addSubscription = useCallback(async (itemData: Omit<SubscriptionItem, 'id'>) => {
    try {
      const newItem = await SubscriptionService.addSubscription(itemData);
      setSubscriptions(prev => [...prev, newItem].sort((a, b) => a.serviceName.localeCompare(b.serviceName)));
    } catch (error) {
      console.error('Failed to add subscription:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new subscription.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const updateSubscription = useCallback(async (id: string, itemData: Partial<Omit<SubscriptionItem, 'id'>>) => {
    const originalItems = subscriptions;
    setSubscriptions(prev => prev.map(item => (item.id === id ? { ...item, ...itemData } as SubscriptionItem : item)));
    try {
      await SubscriptionService.updateSubscription(id, itemData);
      await fetchSubscriptions();
    } catch (error) {
      console.error('Failed to update subscription:', error);
      setSubscriptions(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update the subscription.',
        variant: 'destructive',
      });
    }
  }, [subscriptions, toast, fetchSubscriptions]);

  const deleteSubscription = useCallback(async (id: string) => {
    const originalItems = subscriptions;
    setSubscriptions(prev => prev.filter(item => item.id !== id));
    try {
      await SubscriptionService.deleteSubscription(id);
    } catch (error) {
      console.error('Failed to delete subscription:', error);
      setSubscriptions(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to delete the subscription.',
        variant: 'destructive',
      });
    }
  }, [subscriptions, toast]);

  return { subscriptions, isLoading, addSubscription, updateSubscription, deleteSubscription, fetchSubscriptions };
}
