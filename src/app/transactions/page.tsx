'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/date-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  ArrowLeft, 
  Pencil, 
  Trash2, 
  ArrowUpDown, 
  Search, 
  PlusCircle, 
  TrendingUp, 
  TrendingDown, 
  ArrowRightLeft,
  XCircle,
  FileSpreadsheet
} from 'lucide-react';
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
import { useTransactionLedger } from './hooks/use-transaction-ledger';
import { TransactionForm } from '@/app/monthly-budget/components/transaction-form';
import type { Transaction } from '@/types';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export default function TransactionLedgerPage() {
  const [startDate, setStartDate] = useState<string | undefined>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string | undefined>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const {
    transactions,
    accounts,
    categories,
    isLoading,
    addTransaction,
    updateTransaction,
    deleteTransaction,
  } = useTransactionLedger(startDate || '', endDate || '');

  // Helper map for category names
  const categoryMap = useMemo(() => {
    return categories.reduce((map, cat) => {
      map[cat.id] = cat.name;
      map[cat.name] = cat.name; // support fallback name matching
      return map;
    }, {} as Record<string, string>);
  }, [categories]);

  // Helper map for account names
  const accountMap = useMemo(() => {
    return accounts.reduce((map, acc) => {
      map[acc.id] = acc.name;
      return map;
    }, {} as Record<string, string>);
  }, [accounts]);

  // Handle Edit Transaction Dialog
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

  // Filter transactions client-side for instantaneous responses
  const filteredTransactions = useMemo(() => {
    let list = [...transactions];

    // Search query filter (matches description)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      list = list.filter(tx => tx.description?.toLowerCase().includes(query));
    }

    // Account ID filter (source or split destination)
    if (selectedAccountId !== 'all') {
      list = list.filter(tx => 
        tx.sourceAccountId === selectedAccountId ||
        tx.paidById === selectedAccountId ||
        tx.splits?.some(s => s.destinationAccountId === selectedAccountId)
      );
    }

    // Category filter (in any split)
    if (selectedCategoryId !== 'all') {
      list = list.filter(tx => 
        tx.splits?.some(s => s.categoryId === selectedCategoryId)
      );
    }

    // Transaction Type filter
    if (selectedType !== 'all') {
      list = list.filter(tx => {
        const isTransfer = tx.splits?.some(s => s.type === 'transfer');
        const isExpense = tx.splits?.some(s => s.type === 'expense');
        const isIncome = !isTransfer && !isExpense;

        if (selectedType === 'transfer') return isTransfer;
        if (selectedType === 'expense') return isExpense && !isTransfer;
        if (selectedType === 'income') return isIncome;
        return true;
      });
    }

    // Sort Direction
    return list.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    });
  }, [transactions, searchQuery, selectedAccountId, selectedCategoryId, selectedType, sortDirection]);

  // Aggregate stats for the current filtered list
  const stats = useMemo(() => {
    let totalExpenses = 0;
    let totalIncome = 0;
    let totalTransfers = 0;

    filteredTransactions.forEach(tx => {
      const hasTransfer = tx.splits?.some(s => s.type === 'transfer');
      const hasExpense = tx.splits?.some(s => s.type === 'expense');

      if (hasTransfer) {
        totalTransfers += tx.amount;
      } else if (hasExpense) {
        totalExpenses += tx.amount;
      } else {
        totalIncome += tx.amount;
      }
    });

    return { totalExpenses, totalIncome, totalTransfers };
  }, [filteredTransactions]);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedAccountId('all');
    setSelectedCategoryId('all');
    setSelectedType('all');
  };

  return (
    <>
      <TransactionForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        accounts={accounts}
        addTransaction={addTransaction}
        updateTransaction={updateTransaction}
        deleteTransaction={deleteTransaction}
        editingTransaction={editingTransaction}
      />

      <div className="container mx-auto max-w-7xl p-4 md:p-8 space-y-6">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/budget">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Dashboard
                </Link>
              </Button>
            </div>
            <h1 className="text-3xl font-bold font-headline text-primary">Transaction Ledger</h1>
            <p className="text-muted-foreground text-sm mt-1">
              A comprehensive history of all transactions across all chequing, savings, and credit accounts.
            </p>
          </div>

          <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Transaction
          </Button>
        </header>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
            <CardHeader className="py-4">
              <CardDescription className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <TrendingUp className="h-4 w-4" /> Total Income
              </CardDescription>
              <CardTitle className="text-2xl text-emerald-700 font-bold">
                {formatCurrency(stats.totalIncome)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-destructive/10 to-transparent border-destructive/20">
            <CardHeader className="py-4">
              <CardDescription className="flex items-center gap-1.5 text-destructive font-medium">
                <TrendingDown className="h-4 w-4" /> Total Expenses
              </CardDescription>
              <CardTitle className="text-2xl text-destructive font-bold">
                {formatCurrency(stats.totalExpenses)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="bg-gradient-to-br from-blue-500/10 to-transparent border-blue-500/20">
            <CardHeader className="py-4">
              <CardDescription className="flex items-center gap-1.5 text-blue-600 font-medium">
                <ArrowRightLeft className="h-4 w-4" /> Total Transfers
              </CardDescription>
              <CardTitle className="text-2xl text-blue-700 font-bold">
                {formatCurrency(stats.totalTransfers)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters Panel */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Filters & Search</span>
              {(searchQuery || selectedAccountId !== 'all' || selectedCategoryId !== 'all' || selectedType !== 'all') && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs h-7 text-muted-foreground hover:text-foreground">
                  <XCircle className="mr-1 h-3.5 w-3.5" /> Clear filters
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Date Filters */}
              <div className="grid gap-1.5 col-span-1 md:col-span-1">
                <Label htmlFor="start-date" className="text-xs">Start Date</Label>
                <DatePicker date={startDate} setDate={setStartDate} />
              </div>
              <div className="grid gap-1.5 col-span-1 md:col-span-1">
                <Label htmlFor="end-date" className="text-xs">End Date</Label>
                <DatePicker date={endDate} setDate={setEndDate} />
              </div>

              {/* Account Filter */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Account</Label>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category Filter */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Category</Label>
                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type Filter */}
              <div className="grid gap-1.5">
                <Label className="text-xs">Type</Label>
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Search Description */}
              <div className="grid gap-1.5 col-span-1 lg:col-span-1">
                <Label className="text-xs">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ledger Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground flex flex-col justify-center items-center gap-2">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span>Loading ledger data...</span>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[120px]">
                      <Button variant="ghost" size="sm" onClick={() => setSortDirection(p => p === 'asc' ? 'desc' : 'asc')} className="p-0 font-semibold h-8 text-muted-foreground">
                        Date <ArrowUpDown className="ml-1 h-3 w-3" />
                      </Button>
                    </TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category / Route</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map(tx => {
                      const expenseSplits = tx.splits?.filter(s => s.type === 'expense') || [];
                      const transferSplits = tx.splits?.filter(s => s.type === 'transfer') || [];
                      
                      const isTransfer = transferSplits.length > 0;
                      const isExpense = expenseSplits.length > 0 && !isTransfer;
                      const isIncome = !isTransfer && !isExpense;

                      let resolvedType = 'Income';
                      let typeIcon = <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
                      let amountColor = 'text-emerald-600 font-semibold';
                      let amountPrefix = '+';

                      if (isTransfer) {
                        resolvedType = 'Transfer';
                        typeIcon = <ArrowRightLeft className="h-3.5 w-3.5 text-blue-500" />;
                        amountColor = 'text-blue-600';
                        amountPrefix = '';
                      } else if (isExpense) {
                        resolvedType = 'Expense';
                        typeIcon = <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
                        amountColor = 'text-foreground';
                        amountPrefix = '-';
                      }

                      // Resolve Route / Category details
                      let categoryDetails = '';
                      if (isTransfer) {
                        const destName = transferSplits.map(s => accountMap[s.destinationAccountId || ''] || 'Unknown Account').join(', ');
                        categoryDetails = destName ? `➔ ${destName}` : 'Transfer';
                      } else if (expenseSplits.length > 1) {
                        categoryDetails = `Split (${expenseSplits.length} categories)`;
                      } else if (expenseSplits.length === 1) {
                        categoryDetails = categoryMap[expenseSplits[0].categoryId || ''] || 'Uncategorized';
                      } else {
                        categoryDetails = 'Income';
                      }

                      return (
                        <TableRow key={tx.id} className="hover:bg-accent/40">
                          <TableCell className="whitespace-nowrap">
                            {tx.date ? format(parseISO(tx.date), 'MMM d, yyyy') : 'No Date'}
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">
                            {tx.description || 'No Description'}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/50 rounded-full px-2 py-0.5 font-medium">
                              {typeIcon} {resolvedType}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm max-w-[250px] truncate">
                            {categoryDetails}
                          </TableCell>
                          <TableCell className="text-sm">
                            {accountMap[tx.sourceAccountId || ''] || 'No Account'}
                          </TableCell>
                          <TableCell className={cn("text-right font-medium", amountColor)}>
                            {amountPrefix}{formatCurrency(tx.amount || 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditTransaction(tx)}>
                                <Pencil className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </Button>

                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Delete</span>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete this transaction and recalculate the balances. This cannot be undone.
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
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                        No transactions found for the selected filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
