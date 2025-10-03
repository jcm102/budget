

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SavingsItem, SubscriptionItem, AutoShipItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as SavingsService from '@/services/savings-service';
import * as SubscriptionService from '@/services/subscription-service';
import * as AutoShipService from '@/services/autoship-service';
import { useSelectedAccount } from '@/hooks/use-selected-account';
import { differenceInCalendarMonths, parse, startOfToday, isBefore, format, addMonths } from 'date-fns';

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

const calculateMonthlyAmount = (totalCost: number, amountSaved: number, dueDateStr: string | null): number => {
    const remainingAmount = totalCost - amountSaved;
    if (remainingAmount <= 0 || !dueDateStr) {
      return 0;
    }

    const today = startOfToday();
    const dueDate = parseDate(dueDateStr);
    
    // If due date is in the past or this month, the full remaining amount is due now.
    if (isBefore(dueDate, addMonths(today, 1))) {
        return remainingAmount;
    }

    // Calculate the number of full months between today and the due date.
    let monthsRemaining = differenceInCalendarMonths(dueDate, today);

    // If the due date is in a future month, but the day of the month is before today's day,
    // we should subtract a month because we don't have a full savings cycle for the last month.
    if (dueDate.getDate() < today.getDate()) {
        monthsRemaining -=1;
    }

    if (monthsRemaining <= 0) {
        return remainingAmount;
    }

    return remainingAmount / monthsRemaining;
};

export function useSavings() {
  const [savingsItems, setSavingsItems] = useState<SavingsItem[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [autoShipItems, setAutoShipItems] = useState<AutoShipItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { selectedAccountId } = useSelectedAccount();

  const enhancedSavingsItems = useMemo(() => {
    return savingsItems.map(item => {
        const enhancedItem: SavingsItem & { monthlyAmount?: number } = { ...item };

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

        const costToUse = (enhancedItem.savingsTarget && enhancedItem.savingsTarget > 0) ? enhancedItem.savingsTarget : enhancedItem.totalCost;
        if (costToUse && enhancedItem.dueDate) {
            enhancedItem.monthlyAmount = calculateMonthlyAmount(costToUse, enhancedItem.amount, enhancedItem.dueDate);
        } else if (enhancedItem.goal) {
            enhancedItem.monthlyAmount = enhancedItem.goal;
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
