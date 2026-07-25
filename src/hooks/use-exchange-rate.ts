'use client';

import { useState, useEffect, useCallback } from 'react';
import * as SettingsService from '@/services/settings-service';

export function useExchangeRate() {
  const [exchangeRate, setExchangeRate] = useState<number>(1.35);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRate = useCallback(async () => {
    try {
      setIsLoading(true);
      const rate = await SettingsService.getExchangeRate();
      setExchangeRate(rate);
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  const updateRate = async (newRate: number) => {
    try {
      await SettingsService.updateExchangeRate(newRate);
      setExchangeRate(newRate);
    } catch (error) {
      console.error('Failed to update rate:', error);
    }
  };

  return { exchangeRate, updateRate, isLoading };
}