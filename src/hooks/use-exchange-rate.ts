
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';
import * as SettingsService from '@/services/settings-service';
import { useFirestore } from '@/firebase';

export function useExchangeRate() {
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const db = useFirestore();

  const fetchRate = useCallback(async () => {
    if (!db) {
        setIsLoading(false);
        return;
    };
    try {
      setIsLoading(true);
      const rate = await SettingsService.getExchangeRate(db);
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
  }, [toast, db]);

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  const updateExchangeRate = useCallback(async (newRate: number) => {
    if (!db) return;
    try {
      await SettingsService.updateExchangeRate(db, newRate);
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
  }, [toast, db]);

  return { exchangeRate, updateExchangeRate, isLoading };
}
