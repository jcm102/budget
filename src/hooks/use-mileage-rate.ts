

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';
import * as SettingsService from '@/services/settings-service';
import { useFirestore } from '@/firebase';

export function useMileageRate() {
  const [mileageRate, setMileageRate] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const db = useFirestore();

  const fetchRate = useCallback(async () => {
    if (!db) return;
    try {
      setIsLoading(true);
      const rate = await SettingsService.getMileageRate(db);
      setMileageRate(rate);
    } catch (error) {
      console.error('Failed to load mileage rate:', error);
      toast({
        title: 'Error',
        description: 'Could not load mileage rate from settings.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, db]);

  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

  const updateMileageRate = useCallback(async (newRate: number) => {
    if (!db) return;
    try {
      await SettingsService.updateMileageRate(db, newRate);
      setMileageRate(newRate);
      toast({
        title: 'Success!',
        description: 'Mileage rate has been updated.',
      });
    } catch (error) {
      console.error('Failed to update mileage rate:', error);
      toast({
        title: 'Error',
        description: 'Could not save the new mileage rate.',
        variant: 'destructive',
      });
    }
  }, [toast, db]);

  return { mileageRate, updateMileageRate, isLoading };
}

    