

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addAccount = useCallback(async (accountData: Omit<AccountDetails, 'id'>) => {
    try {
      await AccountDetailsService.addAccount(accountData);
      await fetchAccounts();
    } catch (error) {
      console.error('Failed to add account:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new account.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchAccounts]);
  
  const updateAccount = useCallback(async (id: string, accountData: Partial<Omit<AccountDetails, 'id'>>) => {
    const originalAccounts = accounts;
    setAccounts(prev => prev.map(acc => acc.id === id ? { ...acc, ...accountData } as AccountDetails : acc));
    try {
      await AccountDetailsService.updateAccount(id, accountData);
      // We don't need a full fetch here, optimistic update is enough unless balances change
      if (accountData.balance !== undefined || accountData.isCalculated !== undefined || accountData.linkedDebtId !== undefined) {
          await fetchAccounts();
      }
    } catch (error) {
       setAccounts(originalAccounts);
       console.error('Failed to update account:', error);
       toast({ title: 'Error', description: 'Failed to update account.', variant: 'destructive'});
    }
  }, [accounts, toast, fetchAccounts]);


  const deleteAccount = useCallback(async (id: string) => {
    const originalAccounts = accounts;
    setAccounts((prev) => prev.filter((acc) => acc.id !== id));
    try {
      await AccountDetailsService.deleteAccount(id);
      await fetchAccounts();
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

  return { accounts, addAccount, updateAccount, deleteAccount, isLoading, fetchAccounts };
}
