'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Transferee } from '@/types';
import { useToast } from './use-toast';
import * as TransfereeService from '@/services/transferee-service';

export function useTransferees() {
  const [transferees, setTransferees] = useState<Transferee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchTransferees = async () => {
      try {
        setIsLoading(true);
        const fetchedTransferees = await TransfereeService.getTransferees();
        setTransferees(fetchedTransferees);
      } catch (error) {
        console.error('Failed to load transferees:', error);
        toast({
          title: 'Error',
          description: 'Failed to load transferees from the database.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchTransferees();
  }, [toast]);

  const addTransferee = useCallback(async (name: string) => {
    try {
      const newTransferee = await TransfereeService.addTransferee(name);
      setTransferees((prev) => [...prev, newTransferee]);
    } catch (error) {
      console.error('Failed to add transferee:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new transferee.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const deleteTransferee = useCallback(async (id: string) => {
    const originalTransferees = transferees;
    setTransferees((prev) => prev.filter((transferee) => transferee.id !== id));
    try {
      await TransfereeService.deleteTransferee(id);
    } catch (error) {
      console.error('Failed to delete transferee:', error);
      setTransferees(originalTransferees);
      toast({
        title: 'Error',
        description: 'Failed to delete the transferee.',
        variant: 'destructive',
      });
    }
  }, [transferees, toast]);

  return { transferees, addTransferee, deleteTransferee, isLoading };
}
