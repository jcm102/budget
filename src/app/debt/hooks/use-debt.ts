'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DebtItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as DebtService from '@/services/debt-service'; // Ensure this service exists
import { useSelectedAccount } from '@/hooks/use-selected-account';

export function useDebt() {
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { selectedAccountId } = useSelectedAccount();
  
  // Guard against infinite loops
  const isFetching = useRef(false);

  const fetchDebts = useCallback(async (accountId: string | null) => {
    if (!accountId || isFetching.current) return;
    
    try {
      isFetching.current = true;
      setIsLoading(true);
      const data = await DebtService.getDebts(accountId);
      setDebts(data);
    } catch (error) {
      console.error('Failed to load debts:', error);
      toast({ title: 'Error', description: 'Failed to load debt data.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, [toast]);

  useEffect(() => {
    fetchDebts(selectedAccountId);
  }, [selectedAccountId, fetchDebts]);

  return { debts, isLoading, refreshDebts: () => fetchDebts(selectedAccountId) };
}