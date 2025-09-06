
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useAccountDetails } from '@/hooks/use-transferees';
import { useTransactions } from '@/hooks/use-transactions';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Transaction, AccountDetails, Category } from '@/types';
import { TransactionForm } from '@/components/transaction-form';
import { useMonthlyBudget } from '@/hooks/use-monthly-budget';
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

export default function AccountDetailPage({ params: { accountId } }: { params: { accountId: string } }) {
  const { accounts, isLoading: isLoadingAccounts } = useAccountDetails();
  const { 
    transactions, 
    isLoading: isLoadingTransactions, 
    fetchTransactionsForAccount,
    accountTransactions,
    updateTransaction,
    deleteTransaction,
  } = useTransactions();

  const { categories, isLoading: isLoadingCategories } = useMonthlyBudget();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    if (accountId) {
      fetchTransactionsForAccount(accountId);
    }
  }, [accountId, fetchTransactionsForAccount]);
  
  const account = useMemo(() => accounts.find(a => a.id === accountId), [accounts, accountId]);

  const categoryMap = useMemo(() => {
    return categories.reduce((map, cat: Category) => {
        map[cat.id] = cat.name;
        return map;
    }, {} as Record<string, string>);
  }, [categories]);
  
  const isLoading = isLoadingAccounts || isLoadingTransactions || isLoadingCategories;

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl p-4 md:p-8 space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

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
        accounts={accounts}
        addTransaction={() => {}} // Not used here, but required by the component
        updateTransaction={updateTransaction}
        deleteTransaction={deleteTransaction}
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
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
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
                  {accountTransactions.length > 0 ? (
                    accountTransactions.map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell>{format(new Date(tx.date), 'PPP')}</TableCell>
                        <TableCell className="font-medium">{tx.description}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tx.splits && tx.splits.length > 1 ? (
                             <span>Multiple ({tx.splits.length})</span>
                          ) : tx.splits && tx.splits.length === 1 ? (
                              categoryMap[tx.splits[0].categoryId] || 'Uncategorized'
                          ) : tx.type === 'transfer' ? (
                            'Transfer'
                          ) : 'Uncategorized'}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell>
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
                                    onClick={() => deleteTransaction(tx.id)}
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
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        No transactions found for this account.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}
