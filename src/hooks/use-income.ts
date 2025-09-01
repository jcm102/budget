
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Income } from '@/types';
import { useToast } from './use-toast';
import * as IncomeService from '@/services/income-service';

export function useIncome() {
  const [income, setIncomeState] = useState<Income | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format

  const fetchIncome = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedIncome = await IncomeService.getIncomeForMonth(currentMonth);
      setIncomeState(fetchedIncome);
    } catch (error) {
      console.error('Failed to load income:', error);
      toast({
        title: 'Error',
        description: 'Failed to load budgeted income from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, toast]);

  useEffect(() => {
    fetchIncome();
  }, [fetchIncome]);

  const setIncome = useCallback(async (amount: number) => {
    try {
      const updatedIncome = await IncomeService.setIncomeForMonth(currentMonth, amount);
      setIncomeState(updatedIncome);
      toast({
        title: 'Success!',
        description: 'Your budgeted income has been updated.',
      });
    } catch (error) {
      console.error('Failed to set income:', error);
      toast({
        title: 'Error',
        description: 'Failed to update your budgeted income.',
        variant: 'destructive',
      });
    }
  }, [currentMonth, toast]);

  return { income, setIncome, isLoading, fetchIncome };
}
