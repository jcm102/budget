

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AutoShipItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as AutoShipService from '@/services/autoship-service';
import { useSelectedAccount } from '@/hooks/use-selected-account';
import { useMonthlyBudget } from '@/app/monthly-budget/hooks/use-monthly-budget';

export function useAutoShip() {
  const [autoShipItems, setAutoShipItems] = useState<AutoShipItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { selectedAccountId } = useSelectedAccount();
  useMonthlyBudget();

  const fetchAutoShipItems = useCallback(async (accountId: string | null) => {
    const targetAccountId = (!accountId || accountId === '' || accountId === 'null') ? 'all' : accountId;
    try {
      setIsLoading(true);
      const fetchedItems = await AutoShipService.getAutoShipItems(targetAccountId);
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
      await AutoShipService.addAutoShipItem(itemData);
      await fetchAutoShipItems(selectedAccountId);
    } catch (error) {
      console.error('Failed to add auto-ship item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new auto-ship item.',
        variant: 'destructive',
      });
    }
  }, [toast, selectedAccountId, fetchAutoShipItems]);

  const updateAutoShipItem = useCallback(async (id: string, itemData: Partial<Omit<AutoShipItem, 'id'>>) => {
    try {
      await AutoShipService.updateAutoShipItem(id, itemData);
      await fetchAutoShipItems(selectedAccountId);
    } catch (error) {
      console.error('Failed to update auto-ship item:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the auto-ship item.',
        variant: 'destructive',
      });
    }
  }, [toast, selectedAccountId, fetchAutoShipItems]);

  const deleteAutoShipItem = useCallback(async (id: string) => {
    try {
      await AutoShipService.deleteAutoShipItem(id);
      await fetchAutoShipItems(selectedAccountId);
    } catch (error) {
      console.error('Failed to delete auto-ship item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the auto-ship item.',
        variant: 'destructive',
      });
    }
  }, [toast, selectedAccountId, fetchAutoShipItems]);

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
