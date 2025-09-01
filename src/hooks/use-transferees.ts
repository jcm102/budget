
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AccountDetails } from '@/types';
import { useToast } from './use-toast';
import * as AccountDetailsService from '@/services/account-details-service';

export function useAccountDetails() {
  const [accounts, setAccounts] = useState<AccountDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchAccounts = useCallback(async () => {
      try {
        setIsLoading(true);
        const fetchedAccounts = await AccountDetailsService.getAccounts();
        setAccounts(fetchedAccounts);
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
    }, [toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const addAccount = useCallback(async (accountData: Omit<AccountDetails, 'id'>) => {
    try {
      const newAccount = await AccountDetailsService.addAccount(accountData);
      setAccounts((prev) => [...prev, newAccount]);
    } catch (error) {
      console.error('Failed to add account:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new account.',
        variant: 'destructive',
      });
    }
  }, [toast]);
  
  const updateAccount = useCallback(async (id: string, accountData: Partial<Omit<AccountDetails, 'id'>>) => {
    const originalAccounts = accounts;
    setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, ...accountData } as AccountDetails : acc));
    try {
      await AccountDetailsService.updateAccount(id, accountData);
    } catch (error) {
       setAccounts(originalAccounts);
       console.error('Failed to update account:', error);
       toast({ title: 'Error', description: 'Failed to update account.', variant: 'destructive'});
    }
  }, [accounts, toast]);


  const deleteAccount = useCallback(async (id: string) => {
    const originalAccounts = accounts;
    setAccounts((prev) => prev.filter((acc) => acc.id !== id));
    try {
      await AccountDetailsService.deleteAccount(id);
    } catch (error) {
      console.error('Failed to delete account:', error);
      setAccounts(originalAccounts);
      toast({
        title: 'Error',
        description: 'Failed to delete the account.',
        variant: 'destructive',
      });
    }
  }, [accounts, toast]);

  return { accounts, addAccount, updateAccount, deleteAccount, isLoading, fetchAccounts };
}
