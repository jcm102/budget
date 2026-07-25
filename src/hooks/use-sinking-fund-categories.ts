'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import * as CategoryService from '@/services/sinking-fund-category-service';

export function useSinkingFundCategories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isFetching = useRef(false); // The "Lock"

  const fetchCategories = useCallback(async () => {
    if (isFetching.current) return; // Stop the loop
    
    try {
      isFetching.current = true;
      setIsLoading(true);
      const data = await CategoryService.getCategories();
      setCategories(data);
    } finally {
      setIsLoading(false);
      isFetching.current = false; // Unlock
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, isLoading };
}