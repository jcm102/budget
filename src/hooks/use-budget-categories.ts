
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Category } from '@/types';
import { useToast } from './use-toast';
import * as BudgetCategoryService from '@/services/budget-category-service';
import { useFirestore } from '@/firebase';

export function useBudgetCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const db = useFirestore();

  const fetchCategories = useCallback(async () => {
    if (!db) return;
    try {
      setIsLoading(true);
      const fetchedCategories = await BudgetCategoryService.getCategories(db);
      setCategories(fetchedCategories);
    } catch (error) {
      console.error('Failed to load budget categories:', error);
      toast({
        title: 'Error',
        description: 'Failed to load budget categories from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, db]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const addCategory = useCallback(async (name: string, parentId: string | null = null) => {
    if (!db) return;
    try {
      await BudgetCategoryService.addCategory(db, name, parentId);
      await fetchCategories(); // Refetch to get the whole tree again
    } catch (error) {
      console.error('Failed to add category:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new category.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchCategories, db]);

  const deleteCategory = useCallback(async (id: string) => {
    if (!db) return;
    try {
      await BudgetCategoryService.deleteCategory(db, id);
      await fetchCategories(); // Refetch to get the updated tree
    } catch (error) {
      console.error('Failed to delete category:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the category.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchCategories, db]);

  return { categories, addCategory, deleteCategory, isLoading, fetchCategories };
}
