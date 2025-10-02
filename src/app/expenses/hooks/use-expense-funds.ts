
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AccountLedgerItem, Account } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as AccountLedgerService from '@/services/account-ledger-service';
import * as AccountService from '@/services/account-service';

const EXPENSE_ACCOUNT_NAME = 'Reimbursable Expenses';

export function useExpenseFunds() {
  const [reimbursableFund, setReimbursableFund] = useState<AccountLedgerItem | null>(null);
  const [honorariumFund, setHonorariumFund] = useState<AccountLedgerItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchFunds = useCallback(async () => {
    try {
      setIsLoading(true);
      const accounts = await AccountService.getAccounts();
      const expenseAccount = accounts.find(acc => acc.name === EXPENSE_ACCOUNT_NAME);

      if (expenseAccount) {
        const ledgerItems = await AccountLedgerService.getLedgerItems(expenseAccount.id);
        const reimbursable = ledgerItems.find(item => item.name === 'Reimbursable Fund') || null;
        const honorarium = ledgerItems.find(item => item.name === 'Honorarium Fund') || null;
        setReimbursableFund(reimbursable);
        setHonorariumFund(honorarium);
      } else {
        setReimbursableFund(null);
        setHonorariumFund(null);
      }
    } catch (error) {
      console.error('Failed to load expense funds:', error);
      toast({
        title: 'Error',
        description: 'Failed to load expense fund data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

  return { reimbursableFund, honorariumFund, isLoading, fetchFunds };
}
