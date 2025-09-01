
'use client';

import { useState, useMemo } from 'react';
import { Pencil, Save, X } from 'lucide-react';
import { useMonthlyBudget } from '@/hooks/use-monthly-budget';
import { useTransactions } from '@/hooks/use-transactions';
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

export function BudgetTable() {
  const { budgetItems, categories, updateBudgetItem, isLoading: isLoadingBudget } = useMonthlyBudget();
  const { transactions, isLoading: isLoadingTransactions } = useTransactions();
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<number>(0);

  const isLoading = isLoadingBudget || isLoadingTransactions;

  const transactionTotals = useMemo(() => {
    return transactions.reduce((acc, transaction) => {
      acc[transaction.categoryId] = (acc[transaction.categoryId] || 0) + transaction.amount;
      return acc;
    }, {} as Record<string, number>);
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const renderLoadingSkeleton = () => (
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={`skeleton-budget-${i}`}>
        <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
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

              return (
                <TableRow key={category.id}>
                  <TableCell className="font-medium">{category.name}</TableCell>
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
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                No budget categories created yet. Go to Settings to add some.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-semibold">Totals</TableCell>
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
