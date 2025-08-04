'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Category } from '@/types';
import { useToast } from './use-toast';
import * as IncomeCategoryService from '@/services/income-category-service';

export function useIncomeCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        const fetchedCategories = await IncomeCategoryService.getCategories();
        setCategories(fetchedCategories);
      } catch (error) {
        console.error('Failed to load categories:', error);
        toast({
          title: 'Error',
          description: 'Failed to load income categories from the database.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchCategories();
  }, [toast]);

  const addCategory = useCallback(async (name: string) => {
    try {
      const newCategory = await IncomeCategoryService.addCategory(name);
      setCategories((prev) => [...prev, newCategory]);
    } catch (error) {
      console.error('Failed to add category:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new category.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const deleteCategory = useCallback(async (id: string) => {
    const originalCategories = categories;
    setCategories((prev) => prev.filter((category) => category.id !== id));
    try {
      await IncomeCategoryService.deleteCategory(id);
    } catch (error) {
      console.error('Failed to delete category:', error);
      setCategories(originalCategories);
      toast({
        title: 'Error',
        description: 'Failed to delete the category.',
        variant: 'destructive',
      });
    }
  }, [categories, toast]);

  return { categories, addCategory, deleteCategory, isLoading };
}
