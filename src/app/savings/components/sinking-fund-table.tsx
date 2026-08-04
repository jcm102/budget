'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format, parseISO, addMonths, subMonths } from 'date-fns';
import { Pencil, Trash2, PlusCircle, DollarSign, MinusCircle, Info, ChevronDown, MoreHorizontal, RotateCcw, ArrowRightLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import type { SavingsItem, Category } from '@/types';
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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { SinkingFundForm } from './sinking-fund-form';
import { useSavings, getExchangeRateForItem, calculateMonthlyAmount, getActiveCycle } from '../hooks/use-savings';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSinkingFundCategories } from '@/hooks/use-sinking-fund-categories';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SinkingFundTransferForm } from './sinking-fund-transfer-form';


const transactionSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero.'),
});

const formatCurrency = (amount: number, currency: 'CAD' | 'USD' = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

function TransactionDialog({ item, transactionType, onSave, children, defaultAmount, displayCurrency = 'CAD' }: { item: SavingsItem, transactionType: 'deposit' | 'withdraw', onSave: (amount: number) => void, children: React.ReactNode, defaultAmount: number, displayCurrency?: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const form = useForm<z.infer<typeof transactionSchema>>({
        resolver: zodResolver(transactionSchema),
        defaultValues: { amount: defaultAmount },
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
                         {isEditing ? (
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
) : (
    <div className="flex items-center space-x-2">
        <span className="text-sm font-medium">{formatCurrency(form.getValues('amount'), displayCurrency as "CAD" | "USD")}</span>
        <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
            Edit
        </Button>
    </div>
)}
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => { setIsEditing(false); setIsOpen(false); form.reset({ amount: defaultAmount }); }}>Cancel</Button>
                            <Button type="submit">Confirm {transactionType}</Button>
                        </DialogFooter>
                    </form>
                 </Form>
            </DialogContent>
        </Dialog>
    )
}


type SortConfig = {
    key: keyof SavingsItem | 'monthlyAmount' | 'progress';
    direction: 'ascending' | 'descending';
} | null;

const SortableHeader = ({ column, label, sortConfig, requestSort, className }: { column: NonNullable<SortConfig>['key'], label: string, sortConfig: SortConfig, requestSort: (key: NonNullable<SortConfig>['key']) => void, className?: string }) => {
  const isSorted = sortConfig !== null && sortConfig.key === column;
  const direction = isSorted && sortConfig ? sortConfig.direction : 'ascending';
  return (
    <TableHead className={className}>
      <Button variant="ghost" onClick={() => requestSort(column)}>
        {label}
        {isSorted && <ChevronDown className={`ml-2 h-4 w-4 transform ${direction === 'descending' ? 'rotate-180' : ''}`} />}
        {!isSorted && <ChevronDown className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-50" />}
      </Button>
    </TableHead>
  )
}

function FundsTable({ 
    items, 
    sortConfig, 
    requestSort,
    handleEdit, 
    handleTransaction,
    handleReset,
    deleteSavingsItem,
    exchangeRate,
    onOpenTransfer
} : {
    items: SavingsItem[],
    sortConfig: SortConfig,
    requestSort: (key: any) => void,
    handleEdit: (item: SavingsItem) => void,
    handleTransaction: (item: SavingsItem, amount: number, type: 'deposit' | 'withdraw') => void,
    handleReset: (item: SavingsItem) => void,
    deleteSavingsItem: (id: string) => void,
    exchangeRate: number | null,
    onOpenTransfer: (sourceFund: SavingsItem) => void;
}) {
     const sortedItems = useMemo(() => {
        let sortableItems = [...items];
        if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            let aValue: any, bValue: any;

            if (sortConfig.key === 'progress') {
                aValue = a.totalCost ? (a.amount / a.totalCost) * 100 : 0;
                bValue = b.totalCost ? (b.amount / b.totalCost) * 100 : 0;
            } else if (sortConfig.key === 'monthlyAmount') {
                aValue = a.monthlyAmount || 0;
                bValue = b.monthlyAmount || 0;
            }
            else {
                aValue = a[sortConfig.key as keyof SavingsItem];
                bValue = b[sortConfig.key as keyof SavingsItem];
            }

            if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
        }
        return sortableItems;
    }, [items, sortConfig]);
    const [currentItem, setCurrentItem] = useState<SavingsItem | null>(null);


    
    const totals = useMemo(() => {
        return items.reduce((acc, item) => {
            const rate = getExchangeRateForItem(item, exchangeRate);
            const isUsd = item.currency === 'USD';
            acc.balance += isUsd ? item.amount * rate : item.amount;
            acc.goal += isUsd ? (item.totalCost || 0) * rate : (item.totalCost || 0);
            acc.monthly += isUsd ? (item.monthlyAmount || 0) * rate : (item.monthlyAmount || 0);
            return acc;
        }, { balance: 0, goal: 0, monthly: 0 });
    }, [items, exchangeRate]);


    return (
        <Table>
            <TableHeader>
                <TableRow className="group">
                    <SortableHeader column="name" label="Fund Name" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader column="amount" label="Balance" sortConfig={sortConfig} requestSort={requestSort} className="text-right w-[90px]"/>
                    <SortableHeader column="totalCost" label="Goal" sortConfig={sortConfig} requestSort={requestSort} className="text-right w-[90px]"/>
                    <SortableHeader column="progress" label="Progress" sortConfig={sortConfig} requestSort={requestSort} className="w-[120px]"/>
                    <SortableHeader column="monthlyAmount" label="Monthly" sortConfig={sortConfig} requestSort={requestSort} className="text-right w-[80px]" />
                    <SortableHeader column="dueDate" label="Due Date" sortConfig={sortConfig} requestSort={requestSort} className="w-[110px]"/>
                    <TableHead className="w-[80px]">
                        <div className="flex items-center gap-1">
                            CAD
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground"><Info className="h-3 w-3" /></Button>
                                </PopoverTrigger>
                                <PopoverContent className="text-sm w-60">
                                    This is the estimated amount in CAD to contribute monthly for USD funds, based on the current exchange rate of {exchangeRate}.
                                </PopoverContent>
                            </Popover>
                        </div>
                    </TableHead>
                    <TableHead className="w-[160px] text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {items.map((item) => {
                    const progress = item.totalCost && item.totalCost > 0 ? (item.amount / item.totalCost) * 100 : 0;
                    const rate = getExchangeRateForItem(item, exchangeRate);
                    const cadContribution = item.currency === 'USD' && item.monthlyAmount ? item.monthlyAmount * rate : null;
                    return (
                    <TableRow key={item.id}>
                        <TableCell className="font-medium">
                            <Link href={`/sinking-funds/${item.id}`} className="hover:underline">{item.name}</Link>
                            {item.currency === 'USD' && <span className="text-xs text-muted-foreground ml-2">USD</span>}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.amount, item.currency)}</TableCell>
                        <TableCell className="text-right">{item.totalCost ? formatCurrency(item.totalCost, item.currency) : '-'}</TableCell>
                        <TableCell>
                            {item.totalCost && (
                                <div className="flex items-center gap-2">
                                    <Progress value={progress} className="w-[60%]" />
                                    <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
                                </div>
                            )}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">{item.monthlyAmount ? formatCurrency(item.monthlyAmount, item.currency) : '-'}</TableCell>
                        <TableCell>{item.dueDate ? format(parseISO(item.dueDate), 'PPP') : '-'}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{cadContribution ? formatCurrency(cadContribution, 'CAD') : '-'}</TableCell>
                        <TableCell className="text-right w-[160px]">
                             <div className="flex items-center justify-end gap-1">
                                 <TransactionDialog item={item} transactionType='deposit' defaultAmount={cadContribution ?? item.monthlyAmount ?? 0} displayCurrency="CAD" onSave={(amount) => handleTransaction(item, amount, 'deposit')}>
                                     <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                                         <DollarSign className="h-3.5 w-3.5 mr-1" />Fund
                                     </Button>
                                 </TransactionDialog>
                                 <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                     <TransactionDialog item={item} transactionType='withdraw' defaultAmount={cadContribution ?? item.monthlyAmount ?? 0} displayCurrency="CAD" onSave={(amount) => handleTransaction(item, amount, 'withdraw')}>
                                         <button className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full">
                                            <MinusCircle className="mr-2 h-4 w-4" /> Withdraw
                                        </button>
                                    </TransactionDialog>
                                    <DropdownMenuItem onClick={() => onOpenTransfer(item)}>
                                        <ArrowRightLeft className="mr-2 h-4 w-4" /> Transfer
                                    </DropdownMenuItem>
                                    {!item.dueDate && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <button className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full">
                                                    <RotateCcw className="mr-2 h-4 w-4" /> Reset
                                                </button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will reset the saved balance for &quot;{item.name}&quot; to zero. This is useful for ongoing funds you've just spent.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleReset(item)}>Reset Balance</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleEdit(item)}>
                                        <Pencil className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <button className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 w-full text-destructive">
                                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                                            </button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently delete this sinking fund and all its transaction history.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => deleteSavingsItem(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            </div>
                        </TableCell>
                    </TableRow>
                    )
                })}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell className="font-semibold">Totals</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(totals.balance)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(totals.goal)}</TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-semibold text-primary">{formatCurrency(totals.monthly)}</TableCell>
                    <TableCell colSpan={3}></TableCell>
                </TableRow>
            </TableFooter>
        </Table>
    )
}

export function SinkingFundTable() {
  const { savingsItems, addSavingsItem, updateSavingsItem, deleteSavingsItem, fundSinkingFund, withdrawFromSinkingFund, resetSinkingFund, transferSinkingFund, isLoading } = useSavings();
  const { categories, isLoading: isLoadingCategories } = useSinkingFundCategories();
  const { user } = useUser();
  const { toast } = useToast();
  const { exchangeRate } = useExchangeRate();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SavingsItem | null>(null);
  const [fundedItemPrompt, setFundedItemPrompt] = useState<SavingsItem | null>(null);
  const [prefillItem, setPrefillItem] = useState<Partial<SavingsItem> | undefined>(undefined);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
  
  const [isTransferFormOpen, setIsTransferFormOpen] = useState(false);
  const [sourceFund, setSourceFund] = useState<SavingsItem | null>(null);

  // Month navigation — defaults to the current month
  const [selectedMonth, setSelectedMonth] = useState(() => format(new Date(), 'yyyy-MM'));
  const currentMonth = format(new Date(), 'yyyy-MM');
  const selectedMonthDate = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    return new Date(y, m - 1, 1);
  }, [selectedMonth]);
  const goToPrevMonth = () => {
    const prevMonth = format(subMonths(selectedMonthDate, 1), 'yyyy-MM');
    if (prevMonth < currentMonth) {
      // Prevent navigating to a month before the current month
      setSelectedMonth(currentMonth);
    } else {
      setSelectedMonth(prevMonth);
    }
  };
  const goToNextMonth = () => setSelectedMonth(format(addMonths(selectedMonthDate, 1), 'yyyy-MM'));

  // Recompute monthlyAmount for every item relative to the selected month's start date.
  // This lets the user see July / August / September projections without re-fetching.
  const adjustedItems = useMemo(() =>
    savingsItems.map(item => {
      const activeCycle = getActiveCycle(item, selectedMonthDate);
      return {
        ...item,
        dueDate: activeCycle.dueDate,
        totalCost: activeCycle.totalCost,
        goal: activeCycle.goal,
        monthlyAmount: calculateMonthlyAmount(item, selectedMonthDate),
      };
    }),
    [savingsItems, selectedMonthDate]
  );

  const handleOpenTransferForm = (fund: SavingsItem) => {
    setSourceFund(fund);
    setIsTransferFormOpen(true);
  };

  const handleEdit = (item: SavingsItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleFormOpenChange = (isOpen: boolean) => {
    setIsFormOpen(isOpen);
    if (!isOpen) {
      setEditingItem(null);
      setPrefillItem(undefined);
    }
  };
  
  const requestSort = (key: NonNullable<SortConfig>['key']) => {
    if (!key) return;
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const handleTransaction = async (item: SavingsItem, amountEnteredCAD: number, type: 'deposit' | 'withdraw') => {
    if (!user) return;
    try {
        const rate = getExchangeRateForItem(item, exchangeRate);
        const amount = item.currency === 'USD' ? amountEnteredCAD / rate : amountEnteredCAD;

        if (type === 'deposit') {
            await fundSinkingFund(item.id, amount);
            toast({ title: "Success!", description: `${formatCurrency(amount)} deposited to "${item.name}".`});
            if (item.totalCost && (item.amount + amount) >= item.totalCost) {
                setFundedItemPrompt({ ...item, amount: item.amount + amount });
            }
        } else {
            await withdrawFromSinkingFund(item.id, amount);
            toast({ title: "Success!", description: `${formatCurrency(amount)} withdrawn from "${item.name}".`});
        }
    } catch (error: any) {
        toast({ title: 'Error', description: error.message || 'Transaction failed.', variant: 'destructive'});
    }
  };

  const handleReset = async (item: SavingsItem) => {
    if (!user) return;
    try {
        await resetSinkingFund(item.id);
        toast({ title: 'Success!', description: `"${item.name}" has been reset.`});
    } catch (error: any) {
        toast({ title: 'Error', description: error.message || 'Could not reset the fund.', variant: 'destructive'});
    }
  };

  const handleTransfer = async (fromFundId: string, toFundId: string, amount: number) => {
    if (!user) return;
    try {
        await transferSinkingFund(fromFundId, toFundId, amount);
        toast({ title: 'Success!', description: 'Funds have been transferred.'});
        setIsTransferFormOpen(false);
    } catch (error: any) {
        toast({ title: 'Error', description: error.message || 'Could not complete transfer.', variant: 'destructive'});
    }
  }


  const renderLoadingSkeleton = () => (
    Array.from({ length: 4 }).map((_, i) => (
      <Skeleton key={`skeleton-fund-${i}`} className="h-10 w-full" />
    ))
  );

  const { grandTotalBalance, grandTotalGoal, grandTotalMonthly } = useMemo(() => {
    return adjustedItems.reduce((acc, item) => {
        const rate = getExchangeRateForItem(item, exchangeRate);
        acc.grandTotalBalance += item.currency === 'USD' ? item.amount * rate : item.amount;
        acc.grandTotalGoal += item.totalCost ? (item.currency === 'USD' ? item.totalCost * rate : item.totalCost) : 0;
        acc.grandTotalMonthly += item.monthlyAmount ? (item.currency === 'USD' ? item.monthlyAmount * rate : item.monthlyAmount) : 0;
        return acc;
    }, { grandTotalBalance: 0, grandTotalGoal: 0, grandTotalMonthly: 0 });
  }, [adjustedItems, exchangeRate]);
  
  const groupedFunds = useMemo(() => {
    const groupMap: Record<string, { category: Category | null, items: SavingsItem[] }> = {};

    adjustedItems.forEach(item => {
        const categoryId = item.categoryId || 'uncategorized';
        if (!groupMap[categoryId]) {
            const category = categories.find(c => c.id === item.categoryId) || null;
            groupMap[categoryId] = { category, items: [] };
        }
        groupMap[categoryId].items.push(item);
    });
    
    // Convert map to array and sort it, putting uncategorized last
    return Object.values(groupMap).sort((a, b) => {
        if (a.category === null) return 1;
        if (b.category === null) return -1;
        return a.category.name.localeCompare(b.category.name);
    });

  }, [adjustedItems, categories]);


  return (
    <>
      <SinkingFundForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addSavingsItem={addSavingsItem}
        updateSavingsItem={updateSavingsItem}
        editingItem={editingItem}
        prefillItem={prefillItem}
      />
      
      {/* Renewal Prompt Dialog */}
      <AlertDialog open={!!fundedItemPrompt} onOpenChange={(open) => !open && setFundedItemPrompt(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Goal Reached! 🎉</AlertDialogTitle>
            <AlertDialogDescription>
              You have fully funded <strong>{fundedItemPrompt?.name}</strong>. Would you like to automatically advance the due date for the next cycle?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, Thanks</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
                if (fundedItemPrompt) {
                    // Start editing the existing item to keep the balance and just push the due date forward.
                    let newDueDate = fundedItemPrompt.dueDate;
                    if (newDueDate) {
                        const parts = newDueDate.split('T')[0].split('-');
                        if (parts.length === 3) {
                            const year = parseInt(parts[0], 10) + 1; // Add 1 year
                            const month = parts[1];
                            const day = parts[2];
                            newDueDate = `${year}-${month}-${day}`;
                        }
                    }

                    const previousCycles = [...(fundedItemPrompt.previousCycles || [])];
                    if (fundedItemPrompt.dueDate && fundedItemPrompt.totalCost) {
                        previousCycles.push({
                            dueDate: fundedItemPrompt.dueDate,
                            totalCost: fundedItemPrompt.totalCost,
                            goal: fundedItemPrompt.goal
                        });
                    }

                    setEditingItem({
                        ...fundedItemPrompt,
                        dueDate: newDueDate,
                        previousCycles
                    });
                    setIsFormOpen(true);
                }
            }}>
              Yes, Renew
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {sourceFund && (
          <SinkingFundTransferForm
            open={isTransferFormOpen}
            onOpenChange={setIsTransferFormOpen}
            sourceFund={sourceFund}
            allFunds={savingsItems}
            onConfirm={handleTransfer}
          />
      )}
      <div className="flex justify-between items-center mb-6 gap-2">
          {/* Month navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={goToPrevMonth}
              disabled={selectedMonth === currentMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-base font-semibold w-36 text-center">
              {format(selectedMonthDate, 'MMMM yyyy')}
            </span>
            <Button variant="outline" size="icon" onClick={goToNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Sinking Fund
          </Button>
      </div>

      {savingsItems.length > 0 && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
                <CardHeader>
                    <CardTitle>Total Balance</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-3xl font-semibold">{formatCurrency(grandTotalBalance)}</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Total Goal</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-3xl font-semibold">{formatCurrency(grandTotalGoal)}</p>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Monthly Contribution — {format(selectedMonthDate, 'MMM yyyy')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-3xl font-semibold text-primary">{formatCurrency(grandTotalMonthly)}</p>
                </CardContent>
            </Card>
        </div>
      )}

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
         {isLoading || isLoadingCategories ? (
            <div className="p-4 space-y-4">
              {renderLoadingSkeleton()}
            </div>
         ) : savingsItems.length > 0 ? (
            <Accordion type="multiple" className="w-full" defaultValue={groupedFunds.map(g => g.category?.id || 'uncategorized')}>
              {groupedFunds.map(({ category, items }) => {
                const categoryTotalMonthly = items.reduce((sum, item) => {
                  const rate = getExchangeRateForItem(item, exchangeRate);
                  const amount = item.monthlyAmount || 0;
                  return sum + (item.currency === 'USD' ? amount * rate : amount);
                }, 0);
                const categoryTotalFunded = items.reduce((sum, item) => {
                  const rate = getExchangeRateForItem(item, exchangeRate);
                  const amount = item.amount || 0;
                  return sum + (item.currency === 'USD' ? amount * rate : amount);
                }, 0);
                return (
                  <AccordionItem key={category?.id || 'uncategorized'} value={category?.id || 'uncategorized'}>
                    <AccordionTrigger className="px-4 py-2 hover:bg-muted/50">
                        <div className="flex justify-between items-center w-full pr-4">
                            <span className="font-semibold text-lg">{category?.name || 'Uncategorized'}</span>
                            <div className="flex gap-4">
                                <div className="bg-background border px-3 py-1 rounded-md flex gap-2 items-center text-sm shadow-sm">
                                    <span className="text-muted-foreground">Monthly:</span>
                                    <span className="font-semibold text-primary">{formatCurrency(categoryTotalMonthly)}</span>
                                </div>
                                <div className="bg-background border px-3 py-1 rounded-md flex gap-2 items-center text-sm shadow-sm">
                                    <span className="text-muted-foreground">Funded (Balance):</span>
                                    <span className="font-semibold">{formatCurrency(categoryTotalFunded)}</span>
                                </div>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                       <FundsTable 
                         items={items}
                         sortConfig={sortConfig}
                         requestSort={requestSort}
                         handleEdit={handleEdit}
                         handleTransaction={handleTransaction}
                         handleReset={handleReset}
                         deleteSavingsItem={deleteSavingsItem}
                         exchangeRate={exchangeRate}
                         onOpenTransfer={handleOpenTransferForm}
                       />
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
         ) : (
            <div className="text-center p-24">
              <p>No sinking funds created yet. Add one to get started!</p>
            </div>
         )}
      </div>
    </>
  );
}
