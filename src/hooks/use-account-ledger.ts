
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AccountLedgerItem } from '@/types';
import { useToast } from './use-toast';
import * as AccountLedgerService from '@/services/account-ledger-service';
import { useSelectedAccount } from './use-selected-account';

export function useAccountLedger() {
  const [ledgerItems, setLedgerItems] = useState<AccountLedgerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { selectedAccountId } = useSelectedAccount();

  const fetchItems = useCallback(async () => {
    if (!selectedAccountId) {
      setLedgerItems([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const fetchedItems = await AccountLedgerService.getLedgerItems(selectedAccountId);
      setLedgerItems(fetchedItems);
    } catch (error) {
      console.error('Failed to load ledger items:', error);
      toast({
        title: 'Error',
        description: 'Failed to load account ledger from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, selectedAccountId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = useCallback(async (itemData: Omit<AccountLedgerItem, 'id' | 'accountId'>) => {
    if (!selectedAccountId) {
        toast({ title: 'Error', description: 'No account selected.', variant: 'destructive' });
        return;
    }
    const fullItemData = { ...itemData, accountId: selectedAccountId };
    try {
      const newItem = await AccountLedgerService.addLedgerItem(fullItemData);
      setLedgerItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Failed to add ledger item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new category.',
        variant: 'destructive',
      });
    }
  }, [toast, selectedAccountId]);

  const updateItem = useCallback(async (id: string, itemData: Partial<Omit<AccountLedgerItem, 'id' | 'accountId'>>) => {
    const originalItems = ledgerItems;
    setLedgerItems(prev => prev.map(item => (item.id === id ? { ...item, ...itemData } as AccountLedgerItem : item)));
    try {
      await AccountLedgerService.updateLedgerItem(id, itemData);
      // No full refetch needed for optimistic updates unless there's a server-side change we need
    } catch (error) {
      console.error('Failed to update ledger item:', error);
      setLedgerItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update the category.',
        variant: 'destructive',
      });
    }
  }, [ledgerItems, toast]);

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

  return { ledgerItems, isLoading, addItem, updateItem, deleteItem, fetchItems };
}
