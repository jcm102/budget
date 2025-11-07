
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { format, parse, startOfMonth, endOfMonth } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, Trash2, ArrowUpDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Transaction, AccountDetails, Category } from '@/types';
import { TransactionForm } from '@/app/monthly-budget/components/transaction-form';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { useTransactions } from '@/app/monthly-budget/hooks/use-transactions';
import { DatePicker } from '@/components/date-picker';
import { Label } from '@/components/ui/label';

const parseDate = (dateString: string) => {
    // This safely parses a 'yyyy-MM-dd' string from a full ISO string into a local Date object.
    const datePart = dateString.split('T')[0];
    return parse(datePart, 'yyyy-MM-dd', new Date());
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function AccountClientPage({
  account,
  initialTransactions,
  allAccounts,
  allCategories
}: {
  account: AccountDetails,
  initialTransactions: Transaction[],
  allAccounts: AccountDetails[],
  allCategories: Category[]
}) {
  
  const { 
    accountTransactions,
    isLoading: isLoadingTransactions, 
    fetchTransactionsForAccount,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useTransactions();
  
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const [startDate, setStartDate] = useState<string | undefined>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string | undefined>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');


  useEffect(() => {
    if (account.id) {
        fetchTransactionsForAccount(account.id);
    }
  }, [account.id, fetchTransactionsForAccount]);
  
  const categoryMap = useMemo(() => {
    return allCategories.reduce((map, cat: Category) => {
        map[cat.id] = cat.name;
        return map;
    }, {} as Record<string, string>);
  }, [allCategories]);

  const filteredTransactions = useMemo(() => {
    if (!startDate || !endDate) {
      return accountTransactions;
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999); // Set to end of day in UTC

    const filtered = accountTransactions.filter(tx => {
      const txDate = new Date(tx.date);
      return txDate >= start && txDate <= end;
    });

    return filtered.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortDirection === 'asc' ? dateA - dateB : dateB - a;
    });

  }, [accountTransactions, startDate, endDate, sortDirection]);
  
  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsFormOpen(true);
  };

  const handleFormOpenChange = (isOpen: boolean) => {
    setIsFormOpen(isOpen);
    if (!isOpen) {
      setEditingTransaction(null);
    }
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
  };

  if (!account) {
    return (
      <div className="container mx-auto max-w-4xl p-4 md:p-8">
        <Card>
          <CardHeader>
            <CardTitle>Account Not Found</CardTitle>
            <CardDescription>The requested account could not be found.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/accounts">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Accounts
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <TransactionForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        accounts={allAccounts}
        addTransaction={addTransaction}
        updateTransaction={updateTransaction}
        deleteTransaction={(id) => deleteTransaction(id, account.id)}
        editingTransaction={editingTransaction}
      />
      <div className="container mx-auto max-w-4xl p-4 md:p-8">
        <header className="mb-8">
          <Button asChild variant="outline">
            <Link href="/accounts">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Accounts
            </Link>
          </Button>
        </header>

        <main>
          <h1 className="text-3xl font-bold font-headline text-primary mb-2">{account.name}</h1>
          <p className="text-2xl font-semibold mb-8">{formatCurrency(account.balance || 0)}</p>

          <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle>Transaction History</CardTitle>
                    <Button variant="outline" size="icon" onClick={toggleSortDirection} className="h-8 w-8">
                        <ArrowUpDown className="h-4 w-4" />
                        <span className="sr-only">Toggle sort direction</span>
                    </Button>
                </div>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <div className="grid gap-2 flex-1">
                  <Label htmlFor="start-date">Start Date</Label>
                  <DatePicker date={startDate} setDate={setStartDate} />
                </div>
                <div className="grid gap-2 flex-1">
                  <Label htmlFor="end-date">End Date</Label>
                  <DatePicker date={endDate} setDate={setEndDate} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
               {isLoadingTransactions ? (
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
               ) : (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {filteredTransactions.length > 0 ? (
                        filteredTransactions.map(tx => {
                            const expenseSplits = tx.splits.filter(s => s.type === 'expense');
                            const transferSplits = tx.splits.filter(s => s.type === 'transfer');

                            const isCredit = tx.sourceAccountId !== account.id;
                            const displayAmount = isCredit 
                                ? transferSplits.find(s => s.destinationAccountId === account.id)?.amount || tx.amount
                                : tx.amount;


                            return (
                            <TableRow key={tx.id}>
                                <TableCell>{format(parseDate(tx.date), 'PPP')}</TableCell>
                                <TableCell className="font-medium">{tx.description}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                    {expenseSplits.length > 0 && transferSplits.length > 0
                                        ? 'Split'
                                        : expenseSplits.length > 1
                                        ? `Multiple (${expenseSplits.length})`
                                        : expenseSplits.length === 1
                                        ? categoryMap[expenseSplits[0].categoryId || ''] || 'Uncategorized'
                                        : 'Transfer'}
                                </TableCell>
                                <TableCell className={cn("text-right", isCredit ? "text-green-600" : "")}>{isCredit ? '+' : '-'} {formatCurrency(displayAmount)}</TableCell>
                                <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditTransaction(tx)}>
                                    <Pencil className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete this transaction. This cannot be undone.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => deleteTransaction(tx.id, account.id)}
                                            className={cn(buttonVariants({ variant: "destructive" }))}
                                        >
                                            Delete
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                                </TableCell>
                            </TableRow>
                            )
                        })
                    ) : (
                        <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center">
                            No transactions found for this date range.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                </Table>
               )}
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}
