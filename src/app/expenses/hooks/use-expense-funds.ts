'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import * as LedgerService from '@/services/account-ledger-service';
import type { AccountDetails } from '@/types';

export function useExpenseFunds() {
  const [honorariumFund, setHonorariumFund] = useState<AccountDetails | null>(null);
  const [reimbursableFund, setReimbursableFund] = useState<AccountDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  /**
   * Fetches the specific fund accounts (Honorarium and Reimbursable)
   * using the server-side Admin SDK service.
   */
  const fetchFunds = useCallback(async () => {
    try {
      setIsLoading(true);
      // Calls the getExpenseFunds function in account-ledger-service.ts
      const funds = await LedgerService.getExpenseFunds();
      
      setHonorariumFund(funds.honorarium);
      setReimbursableFund(funds.reimbursable);
    } catch (error) {
      console.error('Failed to load expense funds:', error);
      toast({
        title: 'Error',
        description: 'Failed to load ledger fund balances.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // Initial load
  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

  return { 
    honorariumFund, 
    reimbursableFund, 
    isLoading, 
    fetchFunds 
  };
}