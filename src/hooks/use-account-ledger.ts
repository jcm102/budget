
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AccountLedgerItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as AccountLedgerService from '@/services/account-ledger-service';
import { useFirestore } from '@/firebase';

export function useAccountLedger(accountId: string | null) {
  const [ledgerItems, setLedgerItems] = useState<AccountLedgerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const db = useFirestore();

  const fetchItems = useCallback(async (currentAccountId: string | null) => {
    if (!db || !currentAccountId) {
      setLedgerItems([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const fetchedLedger = await AccountLedgerService.getLedgerItems(db, currentAccountId);
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
  }, [toast, db]);

  useEffect(() => {
    fetchItems(accountId);
  }, [accountId, fetchItems]);

  const addItem = useCallback(async (itemData: Omit<AccountLedgerItem, 'id'>) => {
    if (!db) return;
    if (!itemData.accountId) {
        toast({ title: 'Error', description: 'No account selected.', variant: 'destructive' });
        return;
    }
    try {
      const newItem = await AccountLedgerService.addLedgerItem(db, itemData);
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
  }, [toast, fetchItems, db]);

  const updateItem = useCallback(async (id: string, itemData: Partial<Omit<AccountLedgerItem, 'id'>>) => {
    if (!db) return;
    try {
      await AccountLedgerService.updateLedgerItem(db, id, itemData);
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
  }, [toast, accountId, fetchItems, db]);

  const deleteItem = useCallback(async (id: string) => {
    if (!db) return;
    try {
      await AccountLedgerService.deleteLedgerItem(db, id);
      setLedgerItems(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('Failed to delete ledger item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the category.',
        variant: 'destructive',
      });
    }
  }, [toast, db]);

  return { 
      ledgerItems, 
      isLoading, 
      addItem, 
      updateItem, 
      deleteItem,
      fetchItems: () => fetchItems(accountId) 
    };
}
