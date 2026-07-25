'use client';

import { useState, useEffect, useCallback } from 'react';
import * as SettingsService from '@/services/settings-service';

export function useMileageRate() {
  const [rate, setRate] = useState<number>(0.65);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRate = useCallback(async () => {
    try {
      setIsLoading(true);
      const val = await SettingsService.getMileageRate();
      setRate(val);
    } catch (error) {
      console.error("Failed to fetch mileage rate", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  return { rate, isLoading };
}