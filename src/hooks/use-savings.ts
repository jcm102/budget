

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SavingsItem, SubscriptionItem, AutoShipItem } from '@/types';
import { useToast } from './use-toast';
import * as SavingsService from '@/services/savings-service';
import * as SubscriptionService from '@/services/subscription-service';
import * as AutoShipService from '@/services/autoship-service';
import { useSelectedAccount } from '@/hooks/use-selected-account';
import { format, addMonths } from 'date-fns';

const parseDate = (dateString: string): Date => {
    if (!dateString) return new Date();
    const datePart = dateString.split('T')[0];
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day);
};

const getNextBillingDate = (item: SubscriptionItem | AutoShipItem): Date => {
    if ('nextShipmentDate' in item) { 
        return parseDate(item.nextShipmentDate);
    }
    const today = new Date();
    const monthsToAdd = { 'Monthly': 1, 'Quarterly': 3, 'Annually': 12 };
    return addMonths(today, monthsToAdd[item.billingFrequency]);
}

export function useSavings() {
  const [savingsItems, setSavingsItems] = useState<SavingsItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [autoShipItems, setAutoShipItems] = useState<AutoShipItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { selectedAccountId } = useSelectedAccount();

  const enhancedSavingsItems = useMemo(() => {
    return savingsItems.map(item => {
        const enhancedItem: SavingsItem = { ...item };

        const subscription = subscriptions.find(s => s.serviceName.toLowerCase() === item.name.toLowerCase());
        if (subscription && !item.dueDate) {
            const dueDate = getNextBillingDate(subscription);
            enhancedItem.dueDate = format(dueDate, 'yyyy-MM-dd');
        }
        if (subscription && !item.totalCost) {
            enhancedItem.totalCost = item.totalCost ?? subscription.cost;
        }
        
        const autoShip = autoShipItems.find(a => a.item.toLowerCase() === item.name.toLowerCase());
        if (autoShip && !item.dueDate) {
            const dueDate = getNextBillingDate(autoShip);
            enhancedItem.dueDate = format(dueDate, 'yyyy-MM-dd');
        }
        if (autoShip && !item.totalCost) {
            enhancedItem.totalCost = item.totalCost ?? autoShip.estimatedCost;
        }

        return enhancedItem;
    });
  }, [savingsItems, subscriptions, autoShipItems]);


  const fetchAllData = useCallback(async (accountId: string | null) => {
    if (!accountId) {
      setSavingsItems([]);
      setSubscriptions([]);
      setAutoShipItems([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const [
        fetchedItems, 
        fetchedSubscriptions, 
        fetchedAutoShips
      ] = await Promise.all([
        SavingsService.getSavingsItems(accountId),
        SubscriptionService.getSubscriptions(accountId),
        AutoShipService.getAutoShipItems(accountId),
      ]);
      setSavingsItems(fetchedItems);
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
    fetchAllData(selectedAccountId);
  }, [selectedAccountId, fetchAllData]);

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
       await fetchAllData(selectedAccountId);
    } catch (error) {
      console.error('Failed to update savings item:', error);
      setSavingsItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update the fund.',
        variant: 'destructive',
      });
    }
  }, [savingsItems, toast, selectedAccountId, fetchAllData]);

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
    savingsItems: enhancedSavingsItems, 
    subscriptions,
    autoShipItems,
    isLoading, 
    addSavingsItem, 
    updateSavingsItem, 
    deleteSavingsItem, 
    fetchSavingsItems: () => fetchAllData(selectedAccountId)
  };
}
