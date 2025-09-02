
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Category } from '@/types';
import { useToast } from './use-toast';
import * as BudgetCategoryService from '@/services/budget-category-service';

export function useBudgetCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchCategories = useCallback(async () => {
      try {
        setIsLoading(true);
        const fetchedCategories = await BudgetCategoryService.getCategories();
        setCategories(fetchedCategories);
      } catch (error) {
        console.error('Failed to load categories:', error);
        toast({
          title: 'Error',
          description: 'Failed to load budget categories from the database.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
  }, [toast]);


  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const addCategory = useCallback(async (name: string, parentId: string | null = null) => {
    try {
      await BudgetCategoryService.addCategory(name, parentId);
      await fetchCategories(); // Refetch after adding
    } catch (error) {
      console.error('Failed to add category:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new category.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchCategories]);

  const deleteCategory = useCallback(async (id: string) => {
    try {
      await BudgetCategoryService.deleteCategory(id);
      await fetchCategories(); // Refetch after deleting
    } catch (error: any) {
      console.error('Failed to delete category:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete the category.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchCategories]);

  return { categories, addCategory, deleteCategory, isLoading, fetchCategories };
}
