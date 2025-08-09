
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MileageLog } from '@/types';
import { useToast } from './use-toast';
import * as MileageService from '@/services/mileage-service';

export function useMileage() {
  const [mileageLogs, setMileageLogs] = useState<MileageLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchMileageLogs = useCallback(async () => {
      try {
        setIsLoading(true);
        const fetchedItems = await MileageService.getMileageLogs('active');
        setMileageLogs(fetchedItems);
      } catch (error) {
        console.error('Failed to load mileage logs:', error);
        toast({
          title: 'Error',
          description: 'Failed to load mileage logs from the database.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
  }, [toast]);

  useEffect(() => {
    fetchMileageLogs();
  }, [fetchMileageLogs]);

  const addMileage = useCallback(async (itemData: Omit<MileageLog, 'id'>) => {
    try {
      const newItem = await MileageService.addMileageLog(itemData);
      await fetchMileageLogs();
    } catch (error) {
      console.error('Failed to add mileage log:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new mileage log.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchMileageLogs]);

  const updateMileage = useCallback(async (id: string, itemData: Omit<MileageLog, 'id'>) => {
    try {
      await MileageService.updateMileageLog(id, itemData);
       await fetchMileageLogs();
    } catch (error) {
      console.error('Failed to update mileage log:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the mileage log.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchMileageLogs]);

  const deleteMileage = useCallback(async (id: string) => {
    try {
      await MileageService.deleteMileageLog(id);
       await fetchMileageLogs();
    } catch (error) {
      console.error('Failed to delete mileage log:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the mileage log.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchMileageLogs]);

  return { mileageLogs, addMileage, updateMileage, deleteMileage, isLoading, fetchMileageLogs };
}
