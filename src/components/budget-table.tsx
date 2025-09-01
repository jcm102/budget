
'use client';

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Pencil, Save, X, ChevronDown } from 'lucide-react';
import { useMonthlyBudget } from '@/hooks/use-monthly-budget';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from './ui/skeleton';
import { Progress } from './ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/types';

type BudgetTableProps = {
    transactions: Transaction[];
    isLoading: boolean;
}

export function BudgetTable({ transactions, isLoading }: BudgetTableProps) {
  const { budgetItems, categories, updateBudgetItem } = useMonthlyBudget();
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<number>(0);
  const [openRows, setOpenRows] = useState<Record<string, boolean>>({});

  const { transactionTotals, transactionsByCategory } = useMemo(() => {
    const totals: Record<string, number> = {};
    const byCategory: Record<string, Transaction[]> = {};

    transactions.forEach((transaction) => {
      totals[transaction.categoryId] = (totals[transaction.categoryId] || 0) + transaction.amount;
      if (!byCategory[transaction.categoryId]) {
        byCategory[transaction.categoryId] = [];
      }
      byCategory[transaction.categoryId].push(transaction);
    });
    return { transactionTotals: totals, transactionsByCategory: byCategory };
  }, [transactions]);

  const handleEdit = (categoryId: string, currentBudget: number) => {
    setEditingRow(categoryId);
    setEditingValue(currentBudget);
  };

  const handleSave = (categoryId: string) => {
    updateBudgetItem(categoryId, editingValue);
    setEditingRow(null);
  };

  const handleCancel = () => {
    setEditingRow(null);
  };

  const toggleRow = (categoryId: string) => {
    setOpenRows(prev => ({...prev, [categoryId]: !prev[categoryId]}));
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const renderLoadingSkeleton = () => (
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={`skeleton-budget-${i}`}>
        <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const totalBudgeted = budgetItems.reduce((acc, item) => acc + item.budgeted, 0);
  const totalSpent = Object.values(transactionTotals).reduce((acc, val) => acc + val, 0);

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]"></TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Budgeted</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
            <TableHead className="w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            renderLoadingSkeleton()
          ) : categories.length > 0 ? (
            categories.map((category) => {
              const budgetItem = budgetItems.find(b => b.categoryId === category.id);
              const budgeted = budgetItem?.budgeted || 0;
              const actual = transactionTotals[category.id] || 0;
              const remaining = budgeted - actual;
              const progress = budgeted > 0 ? (actual / budgeted) * 100 : 0;
              const isEditing = editingRow === category.id;
              const categoryTransactions = transactionsByCategory[category.id] || [];
              const hasTransactions = categoryTransactions.length > 0;
              const isOpen = openRows[category.id] || false;

              return (
                <Collapsible asChild key={category.id} open={isOpen} onOpenChange={() => toggleRow(category.id)}>
                   <React.Fragment>
                    <TableRow className="font-medium data-[state=open]:bg-muted/50">
                      <TableCell>
                        <CollapsibleTrigger asChild>
                           <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!hasTransactions}>
                            <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "-rotate-180")} />
                          </Button>
                        </CollapsibleTrigger>
                      </TableCell>
                      <TableCell>{category.name}</TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            value={editingValue}
                            onChange={(e) => setEditingValue(parseFloat(e.target.value) || 0)}
                            className="h-8 text-right"
                          />
                        ) : (
                          formatCurrency(budgeted)
                        )}
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(actual)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span className={remaining < 0 ? 'text-destructive' : ''}>
                            {formatCurrency(remaining)}
                          </span>
                          <Progress value={progress} className="h-2 w-24 mt-1" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSave(category.id)}>
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancel}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(category.id, budgeted)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                        <TableRow className="bg-secondary/20 hover:bg-secondary/30">
                            <TableCell colSpan={6} className="p-0">
                                <div className="p-4 pl-14">
                                <Table>
                                    <TableBody>
                                    {categoryTransactions.map(tx => (
                                        <TableRow key={tx.id} className="border-b-0 hover:bg-secondary/50">
                                        <TableCell className="py-2">{format(new Date(tx.date), 'MMM dd')}</TableCell>
                                        <TableCell className="py-2">{tx.description}</TableCell>
                                        <TableCell className="py-2 text-right">{formatCurrency(tx.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                    </TableBody>
                                </Table>
                                </div>
                            </TableCell>
                        </TableRow>
                    </CollapsibleContent>
                   </React.Fragment>
                </Collapsible>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                No budget categories created yet. Go to Settings to add some.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2} className="font-semibold">Totals</TableCell>
            <TableCell className="text-right font-semibold">{formatCurrency(totalBudgeted)}</TableCell>
            <TableCell className="text-right font-semibold">{formatCurrency(totalSpent)}</TableCell>
            <TableCell className="text-right font-semibold">{formatCurrency(totalBudgeted - totalSpent)}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

