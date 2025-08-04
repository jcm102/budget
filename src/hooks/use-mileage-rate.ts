'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';
import * as SettingsService from '@/services/settings-service';

export function useMileageRate() {
  const [mileageRate, setMileageRate] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchRate = async () => {
      try {
        setIsLoading(true);
        const fetchedRate = await SettingsService.getMileageRate();
        setMileageRate(fetchedRate);
      } catch (error) {
        console.error('Failed to load mileage rate:', error);
        toast({
          title: 'Error',
          description: 'Failed to load mileage rate from the database.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchRate();
  }, [toast]);

  const updateMileageRate = useCallback(async (rate: number) => {
    const originalRate = mileageRate;
    setMileageRate(rate);
    try {
      await SettingsService.updateMileageRate(rate);
      toast({
        title: 'Success',
        description: 'Default mileage rate has been updated.',
      });
    } catch (error) {
      setMileageRate(originalRate);
      console.error('Failed to update mileage rate:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the mileage rate.',
        variant: 'destructive',
      });
    }
  }, [mileageRate, toast]);

  return { mileageRate, updateMileageRate, isLoading };
}
