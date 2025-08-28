
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AccountLedgerItem, SavingsItem, Goal } from '@/types';
import { useToast } from './use-toast';
import * as AccountLedgerService from '@/services/account-ledger-service';
import * as SavingsService from '@/services/savings-service';
import * as GoalService from '@/services/goal-service';

export function useAccountLedger(accountId: string | null) {
  const [ledgerItems, setLedgerItems] = useState<AccountLedgerItem[]>([]);
  const [savingsItems, setSavingsItems] = useState<SavingsItem[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchItems = useCallback(async (currentAccountId: string | null) => {
    if (!currentAccountId) {
      setLedgerItems([]);
      setSavingsItems([]);
      setGoals([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const [fetchedLedger, fetchedSavings, fetchedGoals] = await Promise.all([
        AccountLedgerService.getLedgerItems(currentAccountId),
        SavingsService.getSavingsItems(currentAccountId),
        GoalService.getGoals(currentAccountId),
      ]);
      setLedgerItems(fetchedLedger);
      setSavingsItems(fetchedSavings);
      setGoals(fetchedGoals);
    } catch (error) {
      console.error('Failed to load account ledger data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load account ledger data from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchItems(accountId);
  }, [accountId, fetchItems]);

  const addItem = useCallback(async (itemData: Omit<AccountLedgerItem, 'id'>) => {
    if (!itemData.accountId) {
        toast({ title: 'Error', description: 'No account selected.', variant: 'destructive' });
        return;
    }
    try {
      const newItem = await AccountLedgerService.addLedgerItem(itemData);
      if (newItem.accountId === accountId) {
        setLedgerItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch (error) {
      console.error('Failed to add ledger item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new category.',
        variant: 'destructive',
      });
    }
  }, [toast, accountId]);

  const updateItem = useCallback(async (id: string, itemData: Partial<Omit<AccountLedgerItem, 'id'>>) => {
    const originalItems = ledgerItems;
    const originalAccount = ledgerItems.find(item => item.id === id)?.accountId;
    
    // Optimistic update
    setLedgerItems(prev => prev.map(item => (item.id === id ? { ...item, ...itemData } as AccountLedgerItem : item))
                                .filter(item => itemData.accountId ? item.accountId === itemData.accountId : true));
    try {
      await AccountLedgerService.updateLedgerItem(id, itemData);
       // If account was changed, we need to refetch to remove it from the current view.
      if (itemData.accountId && itemData.accountId !== originalAccount) {
          await fetchItems(accountId);
      }
    } catch (error) {
      console.error('Failed to update ledger item:', error);
      setLedgerItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update the category.',
        variant: 'destructive',
      });
    }
  }, [ledgerItems, toast, accountId, fetchItems]);

  const deleteItem = useCallback(async (id: string) => {
    const originalItems = ledgerItems;
    setLedgerItems(prev => prev.filter(item => item.id !== id));
    try {
      await AccountLedgerService.deleteLedgerItem(id);
    } catch (error) {
      console.error('Failed to delete ledger item:', error);
      setLedgerItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to delete the category.',
        variant: 'destructive',
      });
    }
  }, [ledgerItems, toast]);

  return { ledgerItems, savingsItems, goals, isLoading, addItem, updateItem, deleteItem, fetchItems: () => fetchItems(accountId) };
}
