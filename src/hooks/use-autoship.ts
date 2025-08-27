
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AutoShipItem } from '@/types';
import { useToast } from './use-toast';
import * as AutoShipService from '@/services/autoship-service';
import { useSelectedAccount } from './use-selected-account';

export function useAutoShip() {
  const [autoShipItems, setAutoShipItems] = useState<AutoShipItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { selectedAccountId } = useSelectedAccount();

  const fetchAutoShipItems = useCallback(async (accountId: string | null) => {
    if (!accountId) {
      setAutoShipItems([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const fetchedItems = await AutoShipService.getAutoShipItems(accountId);
      setAutoShipItems(fetchedItems);
    } catch (error) {
      console.error('Failed to load auto-ship items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load auto-ship items from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAutoShipItems(selectedAccountId);
  }, [selectedAccountId, fetchAutoShipItems]);

  const addAutoShipItem = useCallback(async (itemData: Omit<AutoShipItem, 'id'>) => {
    try {
      const newItem = await AutoShipService.addAutoShipItem(itemData);
      setAutoShipItems(prev => [...prev, newItem].sort((a, b) => new Date(a.nextShipmentDate).getTime() - new Date(b.nextShipmentDate).getTime()));
    } catch (error) {
      console.error('Failed to add auto-ship item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new auto-ship item.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const updateAutoShipItem = useCallback(async (id: string, itemData: Partial<Omit<AutoShipItem, 'id'>>) => {
    const originalItems = autoShipItems;
    setAutoShipItems(prev => prev.map(item => (item.id === id ? { ...item, ...itemData } as AutoShipItem : item)));
    try {
      await AutoShipService.updateAutoShipItem(id, itemData);
      await fetchAutoShipItems(selectedAccountId);
    } catch (error) {
      console.error('Failed to update auto-ship item:', error);
      setAutoShipItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update the auto-ship item.',
        variant: 'destructive',
      });
    }
  }, [autoShipItems, toast, selectedAccountId, fetchAutoShipItems]);

  const deleteAutoShipItem = useCallback(async (id: string) => {
    const originalItems = autoShipItems;
    setAutoShipItems(prev => prev.filter(item => item.id !== id));
    try {
      await AutoShipService.deleteAutoShipItem(id);
    } catch (error) {
      console.error('Failed to delete auto-ship item:', error);
      setAutoShipItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to delete the auto-ship item.',
        variant: 'destructive',
      });
    }
  }, [autoShipItems, toast]);

  const shipItem = useCallback(async (id: string) => {
    try {
      await AutoShipService.advanceShipmentDate(id);
      await fetchAutoShipItems(selectedAccountId);
    } catch (error) {
      console.error('Failed to advance shipment date:', error);
      throw error; // Rethrow to be caught in the component for toast message
    }
  }, [selectedAccountId, fetchAutoShipItems]);

  return { autoShipItems, isLoading, addAutoShipItem, updateAutoShipItem, deleteAutoShipItem, shipItem };
}
