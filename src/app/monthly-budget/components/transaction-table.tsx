
'use client';

import { useMemo } from 'react';
import { format, parse } from 'date-fns';
import { useTransactions } from '../hooks/use-transactions';
import { useBudgetCategories } from '@/hooks/use-budget-categories';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

const parseDate = (dateString: string) => {
    return parse(dateString.split('T')[0], 'yyyy-MM-dd', new Date());
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function TransactionTable() {
  const { transactions, isLoading: isLoadingTransactions } = useTransactions();
  const { categories, isLoading: isLoadingCategories } = useBudgetCategories();

  const isLoading = isLoadingTransactions || isLoadingCategories;

  const categoryMap = useMemo(() => {
    return categories.reduce((map, category) => {
      map[category.id] = category.name;
      return map;
    }, {} as Record<string, string>);
  }, [categories]);

  const totalSpent = transactions.reduce((acc, item) => acc + item.amount, 0);

  const renderLoadingSkeleton = () => (
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={`skeleton-transaction-${i}`}>
        <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
      </TableRow>
    ))
  );

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            renderLoadingSkeleton()
          ) : transactions.length > 0 ? (
            transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{format(parseDate(transaction.date), 'PPP')}</TableCell>
                <TableCell className="font-medium">{transaction.description}</TableCell>
                <TableCell>{(transaction.splits && transaction.splits.length > 0 && categoryMap[transaction.splits[0].categoryId || '']) || 'Uncategorized'}</TableCell>
                <TableCell className="text-right">{formatCurrency(transaction.amount)}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center">
                No transactions for this month yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
         {transactions.length > 0 && (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="text-right font-semibold">Total Spent</TableCell>
              <TableCell className="text-right font-semibold">{formatCurrency(totalSpent)}</TableCell>
            </TableRow>
          </TableFooter>
        )}
      </Table>
    </div>
  );
}
