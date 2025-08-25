
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Goal } from '@/types';
import { useToast } from './use-toast';
import * as GoalService from '@/services/goal-service';
import { useSelectedAccount } from './use-selected-account';

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { selectedAccountId } = useSelectedAccount();

  const fetchGoals = useCallback(async () => {
    if (!selectedAccountId) {
      setIsLoading(false);
      setGoals([]);
      return;
    }
    try {
      setIsLoading(true);
      const fetchedItems = await GoalService.getGoals(selectedAccountId);
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
  }, [toast, selectedAccountId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const addGoal = useCallback(async (itemData: Omit<Goal, 'id' | 'accountId'>) => {
    if (!selectedAccountId) {
      toast({ title: 'Error', description: 'No account selected.', variant: 'destructive' });
      return;
    }
    try {
      const newItem = await GoalService.addGoal({ ...itemData, accountId: selectedAccountId });
      setGoals(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Failed to add goal:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new goal.',
        variant: 'destructive',
      });
    }
  }, [toast, selectedAccountId]);

  const updateGoal = useCallback(async (id: string, itemData: Partial<Omit<Goal, 'id' | 'accountId'>>) => {
    const originalItems = goals;
    setGoals(prev => prev.map(item => (item.id === id ? { ...item, ...itemData } as Goal : item)));
    try {
      await GoalService.updateGoal(id, itemData);
      // No full refetch needed for optimistic updates unless there's a server-side change we need
    } catch (error) {
      console.error('Failed to update goal:', error);
      setGoals(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update the goal.',
        variant: 'destructive',
      });
    }
  }, [goals, toast]);

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

  return { goals, isLoading, addGoal, updateGoal, deleteGoal, fetchGoals };
}
