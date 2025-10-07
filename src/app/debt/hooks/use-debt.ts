'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Debt } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as DebtService from '../services/debt-service';
import { errorEmitter } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';

type DebtView = 'current' | 'next';

export function useDebt() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchDebts = useCallback(async () => {
    try {
        setIsLoading(true);
        const fetchedDebts = await DebtService.getDebts();
        setDebts(fetchedDebts);
    } catch (error: any) {
        if (error.message.includes('permission-denied') || error.message.includes('Missing or insufficient permissions')) {
            const contextualError = new FirestorePermissionError({
              path: 'debts',
              operation: 'list',
            });
            errorEmitter.emit('permission-error', contextualError);
        } else {
          console.error('Failed to load debts:', error);
          toast({
              title: 'Error',
              description: 'Failed to load debts from the database.',
              variant: 'destructive',
          });
        }
    } finally {
        setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

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

  const updateDebt = useCallback(async (id: string, debtData: Partial<Omit<Debt, 'id' | 'order'>>) => {
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
    try {
      await DebtService.resetDebtValues();
      await fetchDebts(); // Refetch after service call
      toast({
        title: 'Success!',
        description: 'All debt values for current and next month have been reset.',
      });
    } catch (error) {
      console.error('Failed to reset debts:', error);
      setDebts(originalDebts);
      toast({
        title: 'Error',
        description: 'Failed to reset debt values.',
        variant: 'destructive',
      });
    }
  }, [debts, toast, fetchDebts]);
  
  const cycleToNextMonth = useCallback(async () => {
    try {
        await DebtService.cycleToNextMonth();
        await fetchDebts();
        toast({
            title: 'Cycle Complete!',
            description: 'Next month\'s debt values are now current.',
        });
    } catch (error) {
        console.error('Failed to cycle debts:', error);
        toast({
            title: 'Error',
            description: 'Failed to cycle debt values.',
            variant: 'destructive',
        });
    }
  }, [fetchDebts, toast]);

  const toggleDebtPaid = useCallback(async (id: string, view: DebtView) => {
    const debtToToggle = debts.find(d => d.id === id);
    if (!debtToToggle) return;
    
    if (view === 'current') {
      const isPaid = !(debtToToggle.paid ?? false);
      updateDebt(id, { paid: isPaid });
    } else {
      const isPaid = !(debtToToggle.nextPaid ?? false);
      updateDebt(id, { nextPaid: isPaid });
    }

  }, [debts, updateDebt]);

  return { debts, addDebt, updateDebt, deleteDebt, resetDebtValues, cycleToNextMonth, updateDebtOrder, isLoading, toggleDebtPaid, fetchDebts };
}
