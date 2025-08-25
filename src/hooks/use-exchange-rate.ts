
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';
import * as SettingsService from '@/services/settings-service';

export function useExchangeRate() {
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchRate = async () => {
      try {
        setIsLoading(true);
        const fetchedRate = await SettingsService.getExchangeRate();
        setExchangeRate(fetchedRate);
      } catch (error) {
        console.error('Failed to load exchange rate:', error);
        toast({
          title: 'Error',
          description: 'Failed to load exchange rate from the database.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchRate();
  }, [toast]);

  const updateExchangeRate = useCallback(async (rate: number) => {
    const originalRate = exchangeRate;
    setExchangeRate(rate);
    try {
      await SettingsService.updateExchangeRate(rate);
      toast({
        title: 'Success',
        description: 'Exchange rate has been updated.',
      });
    } catch (error) {
      setExchangeRate(originalRate);
      console.error('Failed to update exchange rate:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the exchange rate.',
        variant: 'destructive',
      });
    }
  }, [exchangeRate, toast]);

  return { exchangeRate, updateExchangeRate, isLoading };
}
