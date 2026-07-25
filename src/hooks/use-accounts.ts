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

  return { 
    accounts, 
    isLoading, 
    refreshAccounts: fetchAccounts 
  };
}