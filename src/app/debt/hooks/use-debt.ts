'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Debt } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as DebtService from '@/app/debt/services/debt-service';

export function useDebt(selectedMonth: string = new Date().toISOString().slice(0, 7)) {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchDebts = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedDebts = await DebtService.getDebts(selectedMonth, includeArchived);
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
  }, [selectedMonth, includeArchived, toast]);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  const addDebt = useCallback(async (debtData: Omit<Debt, 'id' | 'order'>) => {
    try {
      const newDebt = await DebtService.addDebt(debtData, selectedMonth);
      setDebts((prevDebts) => [...prevDebts, newDebt]);
    } catch (error) {
      console.error('Failed to add debt:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new debt entry.',
        variant: 'destructive',
      });
    }
  }, [selectedMonth, toast]);

  const updateDebt = useCallback(async (id: string, debtData: Partial<Omit<Debt, 'id' | 'order'>>) => {
    const originalDebts = debts;
    setDebts((prevDebts) =>
      prevDebts.map((debt) => (debt.id === id ? { ...debt, ...debtData } as Debt : debt))
    );
    try {
      await DebtService.updateDebt(id, selectedMonth, debtData);
    } catch (error) {
      console.error('Failed to update debt:', error);
      setDebts(originalDebts);
      toast({
        title: 'Error',
        description: 'Failed to update the debt entry.',
        variant: 'destructive',
      });
    }
  }, [debts, selectedMonth, toast]);

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
      await DebtService.deleteDebt(id, selectedMonth);
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
      await DebtService.resetDebtValues(selectedMonth);
      await fetchDebts();
      toast({
        title: 'Success!',
        description: `All debt values for ${selectedMonth} have been reset.`,
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
  }, [debts, selectedMonth, toast, fetchDebts]);

  const toggleDebtPaid = useCallback(async (id: string) => {
    const debtToToggle = debts.find((d) => d.id === id);
    if (!debtToToggle) return;

    const isPaid = !(debtToToggle.paid ?? false);
    updateDebt(id, { paid: isPaid });
  }, [debts, updateDebt]);

  const archiveDebt = useCallback(async (id: string, archived: boolean) => {
    try {
      await DebtService.archiveDebt(id, archived);
      setDebts(prev => {
        if (archived && !includeArchived) {
          return prev.filter(d => d.id !== id);
        }
        return prev.map(d => d.id === id ? { ...d, archived } : d);
      });
      toast({
        title: archived ? 'Debt Archived' : 'Debt Restored',
        description: archived ? 'This debt is hidden from active planning.' : 'This debt is restored to active planning.',
      });
    } catch (error) {
      console.error('Failed to archive debt:', error);
      toast({
        title: 'Error',
        description: 'Failed to update archiving status.',
        variant: 'destructive',
      });
    }
  }, [includeArchived, toast]);

  return {
    debts,
    addDebt,
    updateDebt,
    deleteDebt,
    resetDebtValues,
    updateDebtOrder,
    isLoading,
    toggleDebtPaid,
    fetchDebts,
    archiveDebt,
    includeArchived,
    setIncludeArchived
  };
}