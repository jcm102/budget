
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SavingsItem } from '@/types';
import { useToast } from './use-toast';
import * as SavingsService from '@/services/savings-service';
import { addMonths, isBefore, getYear, getMonth, startOfDay } from 'date-fns';

export function useSavings() {
  const [savingsItems, setSavingsItems] = useState<SavingsItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchSavingsItems = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedItems = await SavingsService.getSavingsItems();
      setSavingsItems(fetchedItems);
    } catch (error) {
      console.error('Failed to load savings items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load savings items from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchSavingsItems();
  }, [fetchSavingsItems]);

  const addSavingsItem = useCallback(async (itemData: Omit<SavingsItem, 'id'>) => {
    try {
      const newItem = await SavingsService.addSavingsItem(itemData);
      setSavingsItems(prev => [...prev, newItem].sort((a, b) => a.expense.localeCompare(b.expense)));
    } catch (error) {
      console.error('Failed to add savings item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new savings item.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const updateSavingsItem = useCallback(async (id: string, itemData: Partial<Omit<SavingsItem, 'id'>>) => {
    const originalItems = savingsItems;
    setSavingsItems(prev => prev.map(item => (item.id === id ? { ...item, ...itemData } as SavingsItem : item)));
    try {
      await SavingsService.updateSavingsItem(id, itemData);
    } catch (error) {
      console.error('Failed to update savings item:', error);
      setSavingsItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update the savings item.',
        variant: 'destructive',
      });
    }
  }, [savingsItems, toast]);

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
        description: 'Failed to delete the savings item.',
        variant: 'destructive',
      });
    }
  }, [savingsItems, toast]);
  
  const processMonthlySavings = useCallback(async () => {
    try {
        await SavingsService.processMonthlySavingsForAllItems();
        await fetchSavingsItems(); // refetch to get the latest state
        toast({
            title: 'Success!',
            description: 'Monthly savings have been processed and added to your totals.',
        });
    } catch(error) {
        console.error('Failed to process monthly savings:', error);
        toast({
            title: 'Error',
            description: 'Could not process monthly savings.',
            variant: 'destructive',
        });
    }

  }, [toast, fetchSavingsItems]);

  const recordPurchase = useCallback(async (itemId: string) => {
    try {
      await SavingsService.recordPurchase(itemId);
      await fetchSavingsItems();
      toast({
        title: 'Purchase Recorded!',
        description: 'The item cost has been deducted and the renewal date has been updated.',
      });
    } catch (error) {
      console.error('Failed to record purchase:', error);
      toast({
        title: 'Error',
        description: 'Failed to record the purchase.',
        variant: 'destructive',
      });
    }
  }, [fetchSavingsItems, toast]);


  return { savingsItems, isLoading, addSavingsItem, updateSavingsItem, deleteSavingsItem, processMonthlySavings, recordPurchase };
}
