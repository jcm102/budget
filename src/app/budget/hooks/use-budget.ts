'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BudgetItem, BudgetItemType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import * as BudgetService from '@/app/budget/services/budget-service';
import * as DebtService from '@/app/debt/services/debt-service';
import { useAccountDetails } from '@/hooks/use-transferees';
import { useFirestore } from '@/firebase';
import { format, addMonths, parse } from 'date-fns';
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { addTransaction, deleteTransaction } from '@/app/monthly-budget/services/monthly-budget-service';
import { bulkFundSinkingFunds, bulkWithdrawSinkingFunds } from '@/services/savings-service';

export function useBudget(selectedMonth: string = format(new Date(), 'yyyy-MM'), onMutation?: () => void) {
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { fetchAccounts } = useAccountDetails();
  const db = useFirestore();

  const fetchBudgetItems = useCallback(async () => {
      if (!db) return;
      try {
        setIsLoading(true);
        // Load regular budget items relative to the selected month
        const fetchedItems = await BudgetService.getBudgetItems(db, selectedMonth);
        const regularItems = fetchedItems.filter(item => item.type !== 'Debt Payments');

        // Fetch current and next month's debts dynamically relative to selected month
        const currentMonth = selectedMonth;
        const nextMonth = format(addMonths(parse(selectedMonth + '-01', 'yyyy-MM-dd', new Date()), 1), 'yyyy-MM');
        
        const [currentDebts, nextDebts] = await Promise.all([
          DebtService.getDebts(currentMonth),
          DebtService.getDebts(nextMonth)
        ]);

        const virtualDebtItems: BudgetItem[] = [];
        
        currentDebts.forEach(debt => {
          if (debt.archived && (debt.balance || 0) <= 0) return;
          virtualDebtItems.push({
            id: `virtual-debt-current-${debt.id}`,
            type: 'Debt Payments',
            category: 'N/A',
            description: debt.name,
            amount: debt.plannedPayment || 0,
            date: debt.dueDate || `${currentMonth}-01`,
            frequency: 'One-Time',
            completed: debt.paid || false,
            forNextMonth: false,
            isNextMonthView: false,
            isVirtual: true,
            debtId: debt.id
          } as any);
        });

        nextDebts.forEach(debt => {
          if (debt.archived && (debt.balance || 0) <= 0) return;
          virtualDebtItems.push({
            id: `virtual-debt-next-${debt.id}`,
            type: 'Debt Payments',
            category: 'N/A',
            description: debt.name,
            amount: debt.minimumPayment || 0,
            date: debt.dueDate || `${nextMonth}-01`,
            frequency: 'One-Time',
            completed: false,
            forNextMonth: true,
            isNextMonthView: true,
            isVirtual: true,
            debtId: debt.id
          } as any);
        });

        setBudgetItems([...regularItems, ...virtualDebtItems]);
      } catch (error: any) {
        console.error('Failed to load budget items:', error);
        toast({
          title: 'Error',
          description: 'Failed to load budget items from the database.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }, [toast, db, selectedMonth]);

  useEffect(() => {
    fetchBudgetItems();
  }, [fetchBudgetItems]);

  const addBudgetItem = useCallback(async (itemData: Omit<BudgetItem, 'id'>) => {
    if (!db) return;
    try {
      await BudgetService.addBudgetItem(db, itemData);
      await fetchBudgetItems();
      if (itemData.type === 'Income' || itemData.type === 'Transfers') {
        await fetchAccounts();
      }
      onMutation?.();
    } catch (error) {
      console.error('Failed to add budget item:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new budget item.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchAccounts, fetchBudgetItems, db, onMutation]);

  const updateBudgetItem = useCallback(async (id: string, itemData: Partial<Omit<BudgetItem, 'id' | 'originalId'>>, updateType?: 'instance' | 'pattern') => {
    if (!db) return;
    try {
      await BudgetService.updateBudgetItem(db, id, itemData, updateType);
      await fetchBudgetItems();
      if (itemData.type === 'Income' || itemData.type === 'Transfers') {
        await fetchAccounts();
      }
      onMutation?.();
    } catch (error) {
      console.error('Failed to update budget item:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the budget item.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchAccounts, fetchBudgetItems, db, onMutation]);

  const deleteBudgetItem = useCallback(async (id: string, deleteType?: 'instance' | 'pattern') => {
    if (!db) return;
    try {
      await BudgetService.deleteBudgetItem(db, id, deleteType);
      await fetchBudgetItems();
      onMutation?.();
    } catch (error) {
      console.error('Failed to delete budget item:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the budget item.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchBudgetItems, db, onMutation]);

  const toggleBudgetItemCompleted = useCallback(async (id: string, completed: boolean) => {
    if (id.startsWith('virtual-debt-')) {
      const parts = id.split('-');
      const forNextMonth = parts[2] === 'next';
      const debtId = parts.slice(3).join('-');
      
      const month = forNextMonth 
        ? format(addMonths(parse(selectedMonth + '-01', 'yyyy-MM-dd', new Date()), 1), 'yyyy-MM')
        : selectedMonth;
        
      try {
        await DebtService.updateDebt(debtId, month, { paid: !completed });
        await fetchBudgetItems();
        onMutation?.();
      } catch (error) {
        console.error('Failed to toggle virtual debt:', error);
        toast({
          title: 'Error',
          description: 'Failed to update item completion status.',
          variant: 'destructive',
        });
      }
      return;
    }

    if (!db) return;
    const item = budgetItems.find(i => i.id === id);
    if (!item) return;

    const originalItems = [...budgetItems];
    
    if (!completed) {
      try {
        let transactionId = item.transactionId || null;
        
        if (item.type === 'Transfers') {
          let sourceAccountId = '';
          if (item.transferFrom) {
            const q = query(collection(db, 'transferees'), where('name', '==', item.transferFrom), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) sourceAccountId = snap.docs[0].id;
          }

          let txSplits: any[] = [];
          if (item.splits && item.splits.length > 0) {
            txSplits = item.splits.map(s => ({
              id: crypto.randomUUID(),
              type: s.type,
              amount: s.amount,
              categoryId: s.categoryId || undefined,
              budgetItemName: s.budgetItemName || undefined,
              destinationAccountId: s.destinationAccountId || undefined
            }));
          } else {
            let destAccountId = '';
            if (item.transferTo) {
              const q = query(collection(db, 'transferees'), where('name', '==', item.transferTo), limit(1));
              const snap = await getDocs(q);
              if (!snap.empty) destAccountId = snap.docs[0].id;
            }
            txSplits = [{
              id: crypto.randomUUID(),
              type: 'transfer',
              amount: item.amount,
              destinationAccountId: destAccountId || undefined
            }];
          }

          const txData = {
            description: item.description,
            amount: item.amount,
            date: item.date,
            sourceAccountId: sourceAccountId || undefined,
            splits: txSplits
          };

          const createdTx = await addTransaction(db, txData);
          transactionId = createdTx.id;
        } else if (item.type === 'Pre-Authorized Payments') {
          let sourceAccountId = '';
          let paymentMethod = '';

          if (item.budgetCategoryId) {
            const catDoc = await getDoc(doc(db, 'budget-categories', item.budgetCategoryId));
            if (catDoc.exists()) {
              const catData = catDoc.data();
              paymentMethod = catData.paymentMethod || '';

              if (!paymentMethod && catData.parentId) {
                const parentDoc = await getDoc(doc(db, 'budget-categories', catData.parentId));
                if (parentDoc.exists()) {
                  paymentMethod = parentDoc.data().paymentMethod || '';
                }
              }
            }
          }

          if (!paymentMethod) {
            paymentMethod = 'Libro Chequing';
          }

          const q = query(collection(db, 'transferees'), where('name', '==', paymentMethod), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            sourceAccountId = snap.docs[0].id;
          } else {
            const fallbackQ = query(collection(db, 'transferees'), where('name', '==', 'Libro Chequing'), limit(1));
            const fallbackSnap = await getDocs(fallbackQ);
            if (!fallbackSnap.empty) {
              sourceAccountId = fallbackSnap.docs[0].id;
            }
          }

          const txSplits = [{
            id: crypto.randomUUID(),
            type: 'expense' as const,
            amount: item.amount,
            categoryId: item.budgetCategoryId || undefined,
            budgetItemName: item.description
          }];

          const txData = {
            description: item.description,
            amount: item.amount,
            date: item.date,
            sourceAccountId: sourceAccountId || undefined,
            splits: txSplits
          };

          const createdTx = await addTransaction(db, txData, true);
          transactionId = createdTx.id;
        }

        setBudgetItems(prev =>
          prev.map(i =>
            i.id === id ? { ...i, completed: true, transactionId } : i
          )
        );
        await BudgetService.updateBudgetItem(db, id, { completed: true, transactionId });
        // If this is the EFT to Sinking Funds transfer, auto-fund all active sinking fund items
        if (item.description === 'EFT to Sinking Funds') {
          await bulkFundSinkingFunds(selectedMonth);
        }
        onMutation?.();
      } catch (error) {
        console.error('Failed to complete budget item and write transaction:', error);
        setBudgetItems(originalItems);
        toast({
          title: 'Error',
          description: 'Failed to complete item and log transaction.',
          variant: 'destructive',
        });
      }
    } else {
      try {
        if ((item.type === 'Transfers' || item.type === 'Pre-Authorized Payments') && item.transactionId) {
          await deleteTransaction(db, item.transactionId);
        }

        setBudgetItems(prev =>
          prev.map(i =>
            i.id === id ? { ...i, completed: false, transactionId: null } : i
          )
        );
        await BudgetService.updateBudgetItem(db, id, { completed: false, transactionId: null });
        // If this is the EFT to Sinking Funds transfer, reverse the auto-funding
        if (item.description === 'EFT to Sinking Funds') {
          await bulkWithdrawSinkingFunds(selectedMonth);
        }
        onMutation?.();
      } catch (error) {
        console.error('Failed to revert budget item completion:', error);
        setBudgetItems(originalItems);
        toast({
          title: 'Error',
          description: 'Failed to revert completion.',
          variant: 'destructive',
        });
      }
    }
  }, [budgetItems, toast, db, fetchBudgetItems, selectedMonth, onMutation]);

  const cycleBudgetItems = useCallback(async (itemType: BudgetItemType) => {
    if (!db) return;
    try {
      await BudgetService.cycleBudgetItems(db, itemType);
      await fetchBudgetItems();
      onMutation?.();
      toast({
        title: 'Success!',
        description: `${itemType} have been cycled for the next month.`,
      });
    } catch (error) {
      console.error(`Failed to cycle ${itemType}:`, error);
      toast({
        title: 'Error',
        description: `Could not cycle ${itemType}.`,
        variant: 'destructive',
      });
    }
  }, [fetchBudgetItems, toast, db, onMutation]);

  const toggleBudgetItemScheduled = useCallback(async (id: string, scheduled: boolean) => {
    if (!db) return;
    const item = budgetItems.find(i => i.id === id);
    if (!item) return;

    const originalItems = [...budgetItems];
    try {
      setBudgetItems(prev =>
        prev.map(i =>
          i.id === id ? { ...i, scheduled: !scheduled } : i
        )
      );
      await BudgetService.updateBudgetItem(db, id, { scheduled: !scheduled });
      onMutation?.();
    } catch (error) {
      console.error('Failed to toggle budget item scheduled status:', error);
      setBudgetItems(originalItems);
      toast({
        title: 'Error',
        description: 'Failed to update scheduled status.',
        variant: 'destructive',
      });
    }
  }, [db, budgetItems, onMutation, toast]);

  return { 
    budgetItems, 
    addBudgetItem, 
    updateBudgetItem, 
    deleteBudgetItem, 
    toggleBudgetItemCompleted, 
    toggleBudgetItemScheduled,
    cycleBudgetItems,
    isLoading,
    fetchBudgetItems,
  };
}
