
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
      await fetchCategories();
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
    const originalCategories = [...categories];

    // Find all descendant IDs to remove them from the UI optimistically
    const idsToDelete = [id];
    const queue = [id];
    while (queue.length > 0) {
        const parentId = queue.shift();
        const children = categories.filter(c => c.parentId === parentId);
        for (const child of children) {
            idsToDelete.push(child.id);
            queue.push(child.id);
        }
    }
    
    // Optimistically update the UI
    setCategories(prev => prev.filter(c => !idsToDelete.includes(c.id)));
    
    try {
      await BudgetCategoryService.deleteCategory(id);
    } catch (error: any) {
      console.error('Failed to delete category:', error);
      // Revert on error
      setCategories(originalCategories);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete the category.',
        variant: 'destructive',
      });
    }
  }, [categories, toast]);

  return { categories, addCategory, deleteCategory, isLoading, fetchCategories };
}
