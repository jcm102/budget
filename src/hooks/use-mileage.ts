'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MileageLog } from '@/types';
import { useToast } from './use-toast';
import * as MileageService from '@/services/mileage-service';

export function useMileage() {
  const [mileageLogs, setMileageLogs] = useState<MileageLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchMileageLogs = async () => {
      try {
        setIsLoading(true);
        const fetchedItems = await MileageService.getMileageLogs();
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
    };
    fetchMileageLogs();
  }, [toast]);

  const addMileage = useCallback(async (itemData: Omit<MileageLog, 'id'>) => {
    try {
      const newItem = await MileageService.addMileageLog(itemData);
      setMileageLogs((prev) => [...prev, newItem].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error('Failed to add mileage log:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new mileage log.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const updateMileage = useCallback(async (id: string, itemData: Omit<MileageLog, 'id'>) => {
    const originalItems = mileageLogs;
    setMileageLogs((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...itemData } as MileageLog : item))
         .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    );
    try {
      await MileageService.updateMileageLog(id, itemData);
    } catch (error) {
      console.error('Failed to update mileage log:', error);
      setMileageLogs(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update the mileage log.',
        variant: 'destructive',
      });
    }
  }, [mileageLogs, toast]);

  const deleteMileage = useCallback(async (id: string) => {
    const originalItems = mileageLogs;
    setMileageLogs((prev) => prev.filter((item) => item.id !== id));
    try {
      await MileageService.deleteMileageLog(id);
    } catch (error) {
      console.error('Failed to delete mileage log:', error);
      setMileageLogs(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to delete the mileage log.',
        variant: 'destructive',
      });
    }
  }, [mileageLogs, toast]);

  return { mileageLogs, addMileage, updateMileage, deleteMileage, isLoading };
}
