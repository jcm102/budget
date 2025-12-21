

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';
import * as SettingsService from '@/services/settings-service';
import { useFirestore } from '@/firebase';

export function useCommonAccounts() {
  const [commonAccountIds, setCommonAccountIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const db = useFirestore();

  const fetchCommonAccounts = useCallback(async () => {
    if (!db) return;
    try {
      setIsLoading(true);
      const ids = await SettingsService.getCommonAccountIds(db);
      setCommonAccountIds(ids);
    } catch (error) {
      console.error('Failed to load common accounts:', error);
      toast({
        title: 'Error',
        description: 'Could not load common accounts setting.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, db]);

  useEffect(() => {
    fetchCommonAccounts();
  }, [fetchCommonAccounts]);

  const toggleCommonAccount = useCallback(async (accountId: string, isCommon: boolean) => {
    if (!db) return;
    const originalIds = [...commonAccountIds];
    let newIds;
    if (isCommon) {
      newIds = [...originalIds, accountId];
    } else {
      newIds = originalIds.filter(id => id !== accountId);
    }
    setCommonAccountIds(newIds); // Optimistic update

    try {
      await SettingsService.updateCommonAccountIds(db, newIds);
    } catch (error) {
      setCommonAccountIds(originalIds); // Revert on error
      console.error('Failed to update common accounts:', error);
      toast({
        title: 'Error',
        description: 'Could not save your preference.',
        variant: 'destructive',
      });
    }
  }, [commonAccountIds, toast, db]);

  return { commonAccountIds, toggleCommonAccount, isLoading };
}

    