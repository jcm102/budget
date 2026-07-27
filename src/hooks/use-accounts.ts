'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as AccountService from '@/services/account-service';
import { useUser } from '@/firebase'; 
import { useToast } from '@/hooks/use-toast';

export function useAccounts() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const { toast } = useToast();
  const isFetching = useRef(false);

  const fetchAccounts = useCallback(async () => {
    if (!user?.uid || isFetching.current) return;
    
    try {
      isFetching.current = true;
      setIsLoading(true);
      const data = await AccountService.getAccounts(user.uid);
      setAccounts(data);
    } catch (error) {
      console.error('Failed to load accounts:', error);
      toast({
        title: 'Error',
        description: 'Could not sync accounts.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, [user?.uid, toast]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const addAccount = useCallback(async (name: string) => {
    if (!user?.uid) return;
    try {
      await AccountService.addAccount({ name, userId: user.uid });
      await fetchAccounts();
    } catch (error) {
      console.error('Failed to add account:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the account.',
        variant: 'destructive',
      });
    }
  }, [user?.uid, fetchAccounts, toast]);

  const updateAccount = useCallback(async (id: string, name: string) => {
    try {
      await AccountService.updateAccount(id, { name });
      await fetchAccounts();
    } catch (error) {
      console.error('Failed to update account:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the account.',
        variant: 'destructive',
      });
    }
  }, [fetchAccounts, toast]);

  const deleteAccount = useCallback(async (id: string) => {
    try {
      await AccountService.deleteAccount(id);
      await fetchAccounts();
    } catch (error) {
      console.error('Failed to delete account:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the account.',
        variant: 'destructive',
      });
    }
  }, [fetchAccounts, toast]);

  return { 
    accounts, 
    isLoading, 
    addAccount,
    updateAccount,
    deleteAccount,
    refreshAccounts: fetchAccounts 
  };
}