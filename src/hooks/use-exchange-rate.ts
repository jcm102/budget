
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';
import * as SettingsService from '@/services/settings-service';

export function useExchangeRate() {
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchRate = useCallback(async () => {
    try {
      setIsLoading(true);
      const rate = await SettingsService.getExchangeRate();
      setExchangeRate(rate);
    } catch (error) {
      console.error('Failed to load exchange rate:', error);
      toast({
        title: 'Error',
        description: 'Could not load exchange rate from settings.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  const updateExchangeRate = useCallback(async (newRate: number) => {
    try {
      await SettingsService.updateExchangeRate(newRate);
      setExchangeRate(newRate);
      toast({
        title: 'Success!',
        description: 'Exchange rate has been updated.',
      });
    } catch (error) {
      console.error('Failed to update exchange rate:', error);
      toast({
        title: 'Error',
        description: 'Could not save the new exchange rate.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  return { exchangeRate, updateExchangeRate, isLoading };
}
