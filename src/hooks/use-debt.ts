'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Debt } from '@/types';

const DEBT_STORAGE_KEY = 'tasktrack-budget-debt';

export function useDebt() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      try {
        const storedDebts = localStorage.getItem(DEBT_STORAGE_KEY);
        if (storedDebts) {
          setDebts(JSON.parse(storedDebts));
        }
      } catch (error) {
        console.error('Failed to load debts from local storage:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [isClient]);

  useEffect(() => {
    if (isClient && !isLoading) {
      try {
        localStorage.setItem(DEBT_STORAGE_KEY, JSON.stringify(debts));
      } catch (error) {
        console.error('Failed to save debts to local storage:', error);
      }
    }
  }, [debts, isLoading, isClient]);

  const addDebt = useCallback((debtData: Omit<Debt, 'id'>) => {
    const newDebt: Debt = {
      ...debtData,
      id: crypto.randomUUID(),
    };
    setDebts((prevDebts) => [...prevDebts, newDebt]);
  }, []);

  const updateDebt = useCallback((id: string, debtData: Omit<Debt, 'id'>) => {
    setDebts((prevDebts) =>
      prevDebts.map((debt) => (debt.id === id ? { ...debt, ...debtData } : debt))
    );
  }, []);

  const deleteDebt = useCallback((id: string) => {
    setDebts((prevDebts) => prevDebts.filter((debt) => debt.id !== id));
  }, []);

  const resetDebtValues = useCallback(() => {
    setDebts((prevDebts) =>
      prevDebts.map((debt) => ({
        ...debt,
        balance: 0,
        minimumPayment: 0,
        actualPayment: 0,
      }))
    );
  }, []);

  return { debts, addDebt, updateDebt, deleteDebt, resetDebtValues, isLoading };
}
