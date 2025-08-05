
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Debt } from '@/types';
import { useToast } from './use-toast';
import * as DebtService from '@/services/debt-service';

export function useDebt() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDebts = async () => {
      try {
        setIsLoading(true);
        const fetchedDebts = await DebtService.getDebts();
        setDebts(fetchedDebts);
      } catch (error) {
        console.error('Failed to load debts:', error);
        toast({
          title: 'Error',
          description: 'Failed to load debts from the database.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchDebts();
  }, [toast]);

  const addDebt = useCallback(async (debtData: Omit<Debt, 'id' | 'order'>) => {
    try {
      const newDebt = await DebtService.addDebt(debtData);
      setDebts((prevDebts) => [...prevDebts, newDebt]);
    } catch (error) {
      console.error('Failed to add debt:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new debt entry.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const updateDebt = useCallback(async (id: string, debtData: Omit<Debt, 'id' | 'order'>) => {
    const originalDebts = debts;
    setDebts((prevDebts) =>
      prevDebts.map((debt) => (debt.id === id ? { ...debt, ...debtData } as Debt : debt))
    );
    try {
      await DebtService.updateDebt(id, debtData);
    } catch (error) {
      console.error('Failed to update debt:', error);
      setDebts(originalDebts);
      toast({
        title: 'Error',
        description: 'Failed to update the debt entry.',
        variant: 'destructive',
      });
    }
  }, [debts, toast]);

  const updateDebtOrder = useCallback(async (reorderedDebts: Debt[]) => {
    setDebts(reorderedDebts);
    try {
        await DebtService.updateDebtOrder(reorderedDebts);
    } catch (error) {
        console.error('Failed to update debt order:', error);
        toast({
            title: 'Error',
            description: 'Failed to save the new debt order.',
            variant: 'destructive',
        });
    }
  }, [toast]);

  const deleteDebt = useCallback(async (id: string) => {
    const originalDebts = debts;
    setDebts((prevDebts) => prevDebts.filter((debt) => debt.id !== id));
    try {
      await DebtService.deleteDebt(id);
    } catch (error) {
      console.error('Failed to delete debt:', error);
      setDebts(originalDebts);
      toast({
        title: 'Error',
        description: 'Failed to delete the debt entry.',
        variant: 'destructive',
      });
    }
  }, [debts, toast]);
  
  const resetDebtValues = useCallback(async () => {
    const originalDebts = [...debts];
    setDebts(prevDebts =>
      prevDebts.map(debt => ({
        ...debt,
        balance: 0,
        minimumPayment: 0,
        actualPayment: 0,
        dueDate: new Date().toISOString(),
      }))
    );
    try {
      await DebtService.resetDebtValues();
    } catch (error) {
      console.error('Failed to reset debts:', error);
      setDebts(originalDebts);
      toast({
        title: 'Error',
        description: 'Failed to reset debt values.',
        variant: 'destructive',
      });
    }
  }, [debts, toast]);

  return { debts, addDebt, updateDebt, deleteDebt, resetDebtValues, updateDebtOrder, isLoading };
}
