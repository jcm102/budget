'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Debt } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as DebtService from '../services/debt-service';
import { useFirestore } from '@/firebase';

type DebtView = 'current' | 'next';

export function useDebt() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const db = useFirestore();

  const fetchDebts = useCallback(async () => {
    if (!db) return;
    try {
        setIsLoading(true);
        const fetchedDebts = await DebtService.getDebts(db);
        setDebts(fetchedDebts);
    } catch (error: any) {
        console.error('Failed to load debts:', error);
        toast({
            title: 'Error',
            description: 'Failed to load debts from the database.',
            variant: 'destructive',
        });
    } finally {
        setIsLoading(false);
    }
  }, [toast, db]);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  const addDebt = useCallback(async (debtData: Omit<Debt, 'id' | 'order'>) => {
    if (!db) return;
    try {
      const newDebt = await DebtService.addDebt(db, debtData);
      setDebts((prevDebts) => [...prevDebts, newDebt]);
    } catch (error) {
      console.error('Failed to add debt:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new debt entry.',
        variant: 'destructive',
      });
    }
  }, [toast, db]);

  const updateDebt = useCallback(async (id: string, debtData: Partial<Omit<Debt, 'id' | 'order'>>) => {
    if (!db) return;
    const originalDebts = debts;
    setDebts((prevDebts) =>
      prevDebts.map((debt) => (debt.id === id ? { ...debt, ...debtData } as Debt : debt))
    );
    try {
      await DebtService.updateDebt(db, id, debtData);
    } catch (error) {
      console.error('Failed to update debt:', error);
      setDebts(originalDebts);
      toast({
        title: 'Error',
        description: 'Failed to update the debt entry.',
        variant: 'destructive',
      });
    }
  }, [debts, toast, db]);

  const updateDebtOrder = useCallback(async (reorderedDebts: Debt[]) => {
    if (!db) return;
    setDebts(reorderedDebts);
    try {
        await DebtService.updateDebtOrder(db, reorderedDebts);
    } catch (error) {
        console.error('Failed to update debt order:', error);
        toast({
            title: 'Error',
            description: 'Failed to save the new debt order.',
            variant: 'destructive',
        });
    }
  }, [toast, db]);

  const deleteDebt = useCallback(async (id: string) => {
    if (!db) return;
    const originalDebts = debts;
    setDebts((prevDebts) => prevDebts.filter((debt) => debt.id !== id));
    try {
      await DebtService.deleteDebt(db, id);
    } catch (error) {
      console.error('Failed to delete debt:', error);
      setDebts(originalDebts);
      toast({
        title: 'Error',
        description: 'Failed to delete the debt entry.',
        variant: 'destructive',
      });
    }
  }, [debts, toast, db]);
  
  const resetDebtValues = useCallback(async () => {
    if (!db) return;
    const originalDebts = [...debts];
    try {
      await DebtService.resetDebtValues(db);
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
  }, [debts, toast, fetchDebts, db]);
  
  const cycleToNextMonth = useCallback(async () => {
    if (!db) return;
    try {
        await DebtService.cycleToNextMonth(db);
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
  }, [fetchDebts, toast, db]);

  const toggleDebtPaid = useCallback(async (id: string, view: DebtView) => {
    if (!db) return;
    const debtToToggle = debts.find(d => d.id === id);
    if (!debtToToggle) return;
    
    if (view === 'current') {
      const isPaid = !(debtToToggle.paid ?? false);
      updateDebt(id, { paid: isPaid });
    } else {
      const isPaid = !(debtToToggle.nextPaid ?? false);
      updateDebt(id, { nextPaid: isPaid });
    }

  }, [debts, updateDebt, db]);

  return { debts, addDebt, updateDebt, deleteDebt, resetDebtValues, cycleToNextMonth, updateDebtOrder, isLoading, toggleDebtPaid, fetchDebts };
}
