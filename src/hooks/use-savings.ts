
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SavingsItem } from '@/types';
import { useToast } from './use-toast';
import * as SavingsService from '@/services/savings-service';

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
        description: 'Failed to load sinking funds from the database.',
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
      await fetchSavingsItems(); // refetch to be safe
    } catch (error) {
      console.error('Failed to update savings item:', error);
      setSavingsItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update the fund.',
        variant: 'destructive',
      });
    }
  }, [savingsItems, toast, fetchSavingsItems]);

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

  return { savingsItems, isLoading, addSavingsItem, updateSavingsItem, deleteSavingsItem, fetchSavingsItems };
}
