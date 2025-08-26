
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AccountLedgerItem, Account } from '@/types';
import { useToast } from './use-toast';
import * as AccountLedgerService from '@/services/account-ledger-service';
import * as AccountService from '@/services/account-service';
import { useSelectedAccount } from './use-selected-account';

export function useAccountLedger() {
  const [ledgerItems, setLedgerItems] = useState<AccountLedgerItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
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
      const [fetchedItems, fetchedAccounts] = await Promise.all([
        AccountLedgerService.getLedgerItems(selectedAccountId),
        AccountService.getAccounts()
      ]);
      setLedgerItems(fetchedItems);
      setAccounts(fetchedAccounts);
    } catch (error) {
      console.error('Failed to load ledger data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load account ledger data from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, selectedAccountId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = useCallback(async (itemData: Omit<AccountLedgerItem, 'id'>) => {
    if (!itemData.accountId) {
        toast({ title: 'Error', description: 'No account selected.', variant: 'destructive' });
        return;
    }
    try {
      const newItem = await AccountLedgerService.addLedgerItem(itemData);
      if (newItem.accountId === selectedAccountId) {
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
  }, [toast, selectedAccountId]);

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
          await fetchItems();
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
  }, [ledgerItems, toast, fetchItems]);

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

  return { ledgerItems, accounts, isLoading, addItem, updateItem, deleteItem, fetchItems };
}
