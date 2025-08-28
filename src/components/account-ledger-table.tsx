
'use client';

import { useState, useMemo } from 'react';
import type { AccountLedgerItem, SavingsItem, Goal } from '@/types';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
import { AccountLedgerForm } from './account-ledger-form';
import { useAccountLedger } from '@/hooks/use-account-ledger';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';
import { Pencil, Trash2, PlusCircle, ArrowUpDown, DollarSign, MinusCircle, Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useLedgerSettings } from '@/hooks/use-ledger-settings';


const transactionSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero.'),
});

function TransactionDialog({ item, transactionType, onSave, children }: { item: AccountLedgerItem, transactionType: 'deposit' | 'withdraw', onSave: (amount: number) => void, children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const form = useForm<z.infer<typeof transactionSchema>>({
        resolver: zodResolver(transactionSchema),
        defaultValues: { amount: 0 },
    });

    const onSubmit = (values: z.infer<typeof transactionSchema>) => {
        onSave(values.amount);
        setIsOpen(false);
        form.reset();
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{transactionType === 'deposit' ? 'Deposit to' : 'Withdraw from'} "{item.name}"</DialogTitle>
                    <DialogDescription>
                        Enter the amount you wish to {transactionType}.
                    </DialogDescription>
                </DialogHeader>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                         <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button type="submit">Confirm {transactionType}</Button>
                        </DialogFooter>
                    </form>
                 </Form>
            </DialogContent>
        </Dialog>
    )
}

type SortConfig = {
    key: keyof AccountLedgerItem;
    direction: 'ascending' | 'descending';
} | null;

const SortableHeader = ({ column, label, sortConfig, requestSort, className }: { column: SortConfig['key'], label: string, sortConfig: SortConfig, requestSort: (key: SortConfig['key']) => void, className?: string }) => {
  const isSorted = sortConfig?.key === column;
  const direction = isSorted ? sortConfig.direction : 'ascending';
  return (
    <TableHead className={className}>
      <Button variant="ghost" onClick={() => requestSort(column)}>
        {label}
        {isSorted && <ArrowUpDown className={`ml-2 h-4 w-4 transform ${direction === 'descending' ? 'rotate-180' : ''}`} />}
        {!isSorted && <ArrowUpDown className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-50" />}
      </Button>
    </TableHead>
  )
}

export function AccountLedgerTable({ accountId }: { accountId: string | null }) {
  const { ledgerItems, savingsItems, goals, addItem, updateItem, deleteItem, isLoading } = useAccountLedger(accountId);
  const { includeSinkingFunds, includeGoalSavings } = useLedgerSettings();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AccountLedgerItem | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });

  const handleEdit = (item: AccountLedgerItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleFormOpenChange = (isOpen: boolean) => {
    setIsFormOpen(isOpen);
    if (!isOpen) {
      setEditingItem(null);
    }
  };

  const formatCurrency = (amount: number, currency: 'CAD' | 'USD' = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  };

  const requestSort = (key: SortConfig['key']) => {
    if (!key) return;
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const sortedItems = useMemo(() => {
    let sortableItems = [...ledgerItems];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any, bValue: any;
        aValue = a[sortConfig.key as keyof AccountLedgerItem];
        bValue = b[sortConfig.key as keyof AccountLedgerItem];

        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [ledgerItems, sortConfig]);

  const handleTransaction = (item: AccountLedgerItem, amount: number, type: 'deposit' | 'withdraw') => {
    const currentAmount = item.amount;
    const newAmount = type === 'deposit' ? currentAmount + amount : currentAmount - amount;
    updateItem(item.id, { amount: newAmount < 0 ? 0 : newAmount });
  };

  const renderLoadingSkeleton = () => (
    Array.from({ length: 3 }).map((_, i) => (
      <TableRow key={`skeleton-ledger-${i}`}>
        <TableCell colSpan={3}><Skeleton className="h-10 w-full" /></TableCell>
      </TableRow>
    ))
  );
  
  const {
    sinkingFundsCadTotal,
    sinkingFundsUsdTotal,
    goalSavingsTotal,
    totalCad,
    totalUsd,
  } = useMemo(() => {
    const currentLedgerTotal = ledgerItems.reduce((acc, item) => acc + item.amount, 0);

    const currentSinkingFundsCadTotal = includeSinkingFunds
        ? savingsItems.filter(i => i.currency === 'CAD').reduce((acc, item) => acc + item.amount, 0)
        : 0;
    
    const currentSinkingFundsUsdTotal = includeSinkingFunds
        ? savingsItems.filter(i => i.currency === 'USD').reduce((acc, item) => acc + item.amount, 0)
        : 0;
        
    const currentGoalSavingsTotal = includeGoalSavings
        ? goals.reduce((acc, goal) => acc + goal.amount, 0)
        : 0;
    
    const finalTotalCad = currentLedgerTotal + currentSinkingFundsCadTotal + currentGoalSavingsTotal;
    const finalTotalUsd = currentSinkingFundsUsdTotal;

    return {
      sinkingFundsCadTotal: currentSinkingFundsCadTotal,
      sinkingFundsUsdTotal: currentSinkingFundsUsdTotal,
      goalSavingsTotal: currentGoalSavingsTotal,
      totalCad: finalTotalCad,
      totalUsd: finalTotalUsd,
    };
  }, [ledgerItems, savingsItems, goals, includeSinkingFunds, includeGoalSavings]);


  return (
    <>
      <AccountLedgerForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addItem={addItem}
        updateItem={updateItem}
        editingItem={editingItem}
      />
      <div className="flex justify-end items-center mb-6 gap-2">
          <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Category
          </Button>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="group">
                <SortableHeader column="name" label="Category Name" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader column="amount" label="Amount" sortConfig={sortConfig} requestSort={requestSort} className="text-right"/>
                <TableHead className="w-[180px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : (
                    <>
                        {sortedItems.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <TransactionDialog item={item} transactionType='deposit' onSave={(amount) => handleTransaction(item, amount, 'deposit')}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700"><DollarSign className="h-4 w-4" /></Button>
                                        </TransactionDialog>
                                        <TransactionDialog item={item} transactionType='withdraw' onSave={(amount) => handleTransaction(item, amount, 'withdraw')}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700"><MinusCircle className="h-4 w-4" /></Button>
                                        </TransactionDialog>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /></Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this ledger category.</AlertDialogDescription></AlertDialogHeader>
                                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteItem(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>Delete</AlertDialogAction></AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                         {goals.length > 0 && <TableRow className="bg-secondary/50 hover:bg-secondary/70">
                            <TableCell className="font-medium flex items-center gap-2">
                                Goal Savings Balance
                                 <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:bg-transparent hover:text-foreground p-0">
                                            <Info className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-60 text-sm">
                                        This is the total from your Goal Savings and is read-only.
                                    </PopoverContent>
                                </Popover>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(goalSavingsTotal)}</TableCell>
                            <TableCell></TableCell>
                        </TableRow>}
                        {savingsItems.some(i => i.currency === 'CAD') && <TableRow className="bg-secondary/50 hover:bg-secondary/70">
                            <TableCell className="font-medium flex items-center gap-2">
                                Sinking Funds Balance (CAD)
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:bg-transparent hover:text-foreground p-0">
                                            <Info className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-60 text-sm">
                                        This is the total from your Sinking Funds table and is read-only.
                                    </PopoverContent>
                                </Popover>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(sinkingFundsCadTotal, 'CAD')}</TableCell>
                            <TableCell></TableCell>
                        </TableRow>}
                        {savingsItems.some(i => i.currency === 'USD') && <TableRow className="bg-secondary/50 hover:bg-secondary/70">
                            <TableCell className="font-medium flex items-center gap-2">
                                Sinking Funds Balance (USD)
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:bg-transparent hover:text-foreground p-0">
                                            <Info className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-60 text-sm">
                                        This is the total from your Sinking Funds table and is read-only.
                                    </PopoverContent>
                                </Popover>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(sinkingFundsUsdTotal, 'USD')}</TableCell>
                            <TableCell></TableCell>
                        </TableRow>}
                    </>
                )}
                 {(!isLoading && sortedItems.length === 0 && goals.length === 0 && savingsItems.length === 0) && (
                     <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center">
                            No ledger categories or linked funds found for this account.
                        </TableCell>
                    </TableRow>
                 )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold text-right">Total CAD Balance</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totalCad, 'CAD')}</TableCell>
                <TableCell></TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-semibold text-right">Total USD Balance</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totalUsd, 'USD')}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
      </div>
    </>
  );
}

    