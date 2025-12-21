
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Category } from '@/types';
import { useToast } from './use-toast';
import * as WorkCategoryService from '@/services/work-category-service';
import { useFirestore } from '@/firebase';

export function useWorkCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const db = useFirestore();

  useEffect(() => {
    const fetchCategories = async () => {
      if (!db) return;
      try {
        setIsLoading(true);
        const fetchedCategories = await WorkCategoryService.getCategories(db);
        setCategories(fetchedCategories);
      } catch (error) {
        console.error('Failed to load categories:', error);
        toast({
          title: 'Error',
          description: 'Failed to load work expense categories from the database.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchCategories();
  }, [toast, db]);

  const addCategory = useCallback(async (name: string) => {
    if (!db) return;
    try {
      const newCategory = await WorkCategoryService.addCategory(db, name);
      setCategories((prev) => [...prev, newCategory]);
    } catch (error) {
      console.error('Failed to add category:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new category.',
        variant: 'destructive',
      });
    }
  }, [toast, db]);

  const deleteCategory = useCallback(async (id: string) => {
    if (!db) return;
    const originalCategories = categories;
    setCategories((prev) => prev.filter((category) => category.id !== id));
    try {
      await WorkCategoryService.deleteCategory(db, id);
    } catch (error) {
      console.error('Failed to delete category:', error);
      setCategories(originalCategories);
      toast({
        title: 'Error',
        description: 'Failed to delete the category.',
        variant: 'destructive',
      });
    }
  }, [categories, toast, db]);

  return { categories, addCategory, deleteCategory, isLoading };
}
