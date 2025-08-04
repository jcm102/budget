
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { IncomeCategory } from '@/types';
import { useToast } from './use-toast';
import * as CategoryService from '@/services/category-service';

export function useCategories() {
  const [categories, setCategories] = useState<IncomeCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        const fetchedItems = await CategoryService.getCategories();
        setCategories(fetchedItems);
      } catch (error) {
        console.error('Failed to load categories:', error);
        toast({
          title: 'Error',
          description: 'Failed to load categories from the database.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchCategories();
  }, [toast]);

  const addCategory = useCallback(async (itemData: Omit<IncomeCategory, 'id'>) => {
    try {
      const newItem = await CategoryService.addCategory(itemData);
      setCategories((prev) => [...prev, newItem]);
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
    const originalItems = categories;
    setCategories((prev) => prev.filter((item) => item.id !== id));
    try {
      await CategoryService.deleteCategory(id);
    } catch (error) {
      console.error('Failed to delete category:', error);
      setCategories(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to delete the category.',
        variant: 'destructive',
      });
    }
  }, [categories, toast]);

  return { categories, addCategory, deleteCategory, isLoading };
}
