
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Goal } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as GoalService from '@/services/goal-service';
import { useSelectedAccount } from '@/hooks/use-selected-account';

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { selectedAccountId } = useSelectedAccount();

  const fetchGoals = useCallback(async (accountId: string | null) => {
    const targetAccountId = (!accountId || accountId === '' || accountId === 'null') ? 'all' : accountId;
    try {
      setIsLoading(true);
      const fetchedItems = await GoalService.getGoals(targetAccountId);
      setGoals(fetchedItems);
    } catch (error) {
      console.error('Failed to load goals:', error);
      toast({
        title: 'Error',
        description: 'Failed to load goals from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchGoals(selectedAccountId);
  }, [selectedAccountId, fetchGoals]);

  const addGoal = useCallback(async (itemData: Omit<Goal, 'id'>) => {
    try {
      const newItem = await GoalService.addGoal(itemData);
      setGoals(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Failed to add goal:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new goal.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const updateGoal = useCallback(async (id: string, itemData: Partial<Omit<Goal, 'id'>>) => {
    const originalItems = goals;
    setGoals(prev => prev.map(item => (item.id === id ? { ...item, ...itemData } as Goal : item)));
    try {
      await GoalService.updateGoal(id, itemData);
      await fetchGoals(selectedAccountId);
    } catch (error) {
      console.error('Failed to update goal:', error);
      setGoals(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update the goal.',
        variant: 'destructive',
      });
    }
  }, [goals, toast, selectedAccountId, fetchGoals]);

  const deleteGoal = useCallback(async (id: string) => {
    const originalItems = goals;
    setGoals(prev => prev.filter(item => item.id !== id));
    try {
      await GoalService.deleteGoal(id);
    } catch (error) {
      console.error('Failed to delete goal:', error);
      setGoals(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to delete the goal.',
        variant: 'destructive',
      });
    }
  }, [goals, toast]);

  return { goals, isLoading, addGoal, updateGoal, deleteGoal, fetchGoals: () => fetchGoals(selectedAccountId) };
}
