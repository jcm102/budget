
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SavingsItem, Goal, SubscriptionItem, AutoShipItem } from '@/types';
import { useToast } from './use-toast';
import * as SavingsService from '@/services/savings-service';
import * as GoalService from '@/services/goal-service';
import * as SubscriptionService from '@/services/subscription-service';
import * as AutoShipService from '@/services/autoship-service';

export function useSavings() {
  const [savingsItems, setSavingsItems] = useState<SavingsItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [autoShipItems, setAutoShipItems] = useState<AutoShipItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAllData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [
        fetchedItems, 
        fetchedGoals, 
        fetchedSubscriptions, 
        fetchedAutoShips
      ] = await Promise.all([
        SavingsService.getSavingsItems(),
        GoalService.getGoals(),
        SubscriptionService.getSubscriptions(),
        AutoShipService.getAutoShipItems(),
      ]);
      setSavingsItems(fetchedItems);
      setGoals(fetchedGoals);
      setSubscriptions(fetchedSubscriptions);
      setAutoShipItems(fetchedAutoShips);
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
    fetchAllData();
  }, [fetchAllData]);

  const addSavingsItem = useCallback(async (itemData: Omit<SavingsItem, 'id'>) => {
    try {
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

  const updateSavingsItem = useCallback(async (id: string, itemData: Partial<Omit<SavingsItem, 'id'>>) => {
    const originalItems = savingsItems;
    setSavingsItems(prev => prev.map(item => (item.id === id ? { ...item, ...itemData } as SavingsItem : item)));
    try {
      await SavingsService.updateSavingsItem(id, itemData);
      await fetchAllData(); // refetch to be safe
    } catch (error) {
      console.error('Failed to update savings item:', error);
      setSavingsItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update the fund.',
        variant: 'destructive',
      });
    }
  }, [savingsItems, toast, fetchAllData]);

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
    goals,
    subscriptions,
    autoShipItems,
    isLoading, 
    addSavingsItem, 
    updateSavingsItem, 
    deleteSavingsItem, 
    fetchSavingsItems: fetchAllData 
  };
}
