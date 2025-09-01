
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Account } from '@/types';
import { useToast } from './use-toast';
import * as AccountService from '@/services/account-service';
import { useSelectedAccount } from './use-selected-account';

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { selectedAccountId, setSelectedAccountId } = useSelectedAccount();

  const fetchAccounts = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedAccounts = await AccountService.getAccounts();
      setAccounts(fetchedAccounts);
      
      // Set a default selected account only if none is selected and accounts exist
      if (!selectedAccountId && fetchedAccounts.length > 0) {
          const defaultExists = fetchedAccounts.some(a => a.name === 'Primary Account');
          if (defaultExists) {
              setSelectedAccountId(fetchedAccounts.find(a => a.name === 'Primary Account')!.id);
          } else {
              setSelectedAccountId(fetchedAccounts[0].id);
          }
      } else if (selectedAccountId && !fetchedAccounts.some(a => a.id === selectedAccountId)) {
          // If the selected account was deleted, select the first one
          setSelectedAccountId(fetchedAccounts.length > 0 ? fetchedAccounts[0].id : null);
      }

    } catch (error) {
      console.error('Failed to load accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load accounts from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, selectedAccountId, setSelectedAccountId]);

  useEffect(() => {
    fetchAccounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  const addAccount = useCallback(async (name: string) => {
    try {
      await AccountService.addAccount(name);
      await fetchAccounts(); // refetch to get the latest list and set selected ID if needed
    } catch (error) {
      console.error('Failed to add account:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new account.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchAccounts]);
  
  const updateAccount = useCallback(async (id: string, name: string) => {
    const originalAccounts = [...accounts];
    setAccounts((prev) => prev.map(a => a.id === id ? {...a, name} : a));
    try {
      await AccountService.updateAccount(id, name);
      toast({
        title: 'Account Updated',
        description: `The account name has been changed to "${name}".`
      });
    } catch (error) {
      setAccounts(originalAccounts);
       console.error('Failed to update account:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the account name.',
        variant: 'destructive',
      });
    }
  }, [accounts, toast]);

  const deleteAccount = useCallback(async (id: string) => {
    if (accounts.length <= 1) {
        toast({
            title: 'Action not allowed',
            description: 'You must have at least one account.',
            variant: 'destructive',
        });
        return;
    }
    const originalAccounts = accounts;
    setAccounts((prev) => prev.filter((acc) => acc.id !== id));
    try {
      await AccountService.deleteAccount(id);
      await fetchAccounts(); // refetch to update selected account if the deleted one was selected
    } catch (error) {
      console.error('Failed to delete account:', error);
      setAccounts(originalAccounts);
      toast({
        title: 'Error',
        description: 'Failed to delete the account.',
        variant: 'destructive',
      });
    }
  }, [accounts, toast, fetchAccounts]);

  return { accounts, addAccount, deleteAccount, updateAccount, isLoading };
}
