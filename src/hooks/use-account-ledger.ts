
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AccountLedgerItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as AccountLedgerService from '@/services/account-ledger-service';
import { db } from '@/lib/firebase';

export function useAccountLedger(accountId: string | null) {
  const [ledgerItems, setLedgerItems] = useState<AccountLedgerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchItems = useCallback(async (currentAccountId: string | null) => {
    if (!currentAccountId) {
      setLedgerItems([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const fetchedLedger = await AccountLedgerService.getLedgerItems(currentAccountId);
      setLedgerItems(fetchedLedger);
    } catch (error) {
      console.error('Failed to load account ledger data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load ledger categories for the selected account.',
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
      // Refetch to ensure data consistency
      await fetchItems(itemData.accountId);
    } catch (error) {
      console.error('Failed to add ledger item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new category.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchItems]);

  const updateItem = useCallback(async (id: string, itemData: Partial<Omit<AccountLedgerItem, 'id'>>) => {
    try {
      await AccountLedgerService.updateLedgerItem(id, itemData);
      // Refetch after update
      if (accountId) {
        await fetchItems(accountId);
      }
    } catch (error) {
      console.error('Failed to update ledger item:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the category.',
        variant: 'destructive',
      });
    }
  }, [toast, accountId, fetchItems]);

  const deleteItem = useCallback(async (id: string) => {
    try {
      await AccountLedgerService.deleteLedgerItem(id);
      setLedgerItems(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Failed to delete ledger item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the category.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  return { 
      ledgerItems, 
      isLoading, 
      addItem, 
      updateItem, 
      deleteItem,
      fetchItems: () => fetchItems(accountId) 
    };
}
