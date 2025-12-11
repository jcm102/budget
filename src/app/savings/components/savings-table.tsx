
'use client';

import { useState, useMemo } from 'react';
import type { SavingsItem, SubscriptionItem, AutoShipItem, SinkingFundTransaction, Category } from '@/types';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, parse, isSameMonth } from 'date-fns';
import type { ColumnVisibility } from '@/app/savings/page';

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
import { useSavings } from '../hooks/use-savings';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Pencil, Trash2, PlusCircle, ArrowUpDown, DollarSign, MinusCircle, Info, Repeat, PiggyBank, History, CheckCircle, ChevronDown } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SavingsForm } from './savings-form';
import * as SavingsService from '@/services/savings-service';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useSinkingFundCategories } from '@/hooks/use-sinking-fund-categories';

const formatCurrency = (amount: number, currency: 'CAD' | 'USD' = 'CAD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

const transactionSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero.'),
});

function TransactionDialog({ item, transactionType, onSave, children }: { item: SavingsItem, transactionType: 'deposit' | 'withdraw', onSave: (amount: number) => void, children: React.ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const form = useForm<z.infer<typeof transactionSchema>>({
        resolver: zodResolver(transactionSchema),
        defaultValues: { amount: 0 },
    });

    const onSubmit = (values: z.infer<typeof transactionSchema>) => {
        if (transactionType === 'withdraw' && values.amount > item.amount) {
            form.setError("amount", {
                type: "manual",
                message: `Cannot withdraw more than the available ${formatCurrency(item.amount, item.currency)}.`
            });
            return;
        }
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

function TransactionHistoryDialog({ fundId, fundName, userId }: { fundId: string, fundName: string, userId: string | null }) {
    const [isOpen, setIsOpen] = useState(false);
    const [history, setHistory] = useState<SinkingFundTransaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const handleOpenChange = async (open: boolean) => {
        setIsOpen(open);
        if (open && userId) {
            setIsLoading(true);
            const fetchedHistory = await SavingsService.getSinkingFundTransactions(userId, fundId);
            setHistory(fetchedHistory);
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700">
                            <History className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent><p>Transaction History</p></TooltipContent>
            </Tooltip>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Transaction History for &quot;{fundName}&quot;</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={3} className="text-center"><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                            ) : history.length > 0 ? (
                                history.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell>{format(parse(tx.date, "yyyy-MM-dd", new Date()), 'PPP')}</TableCell>
                                        <TableCell className={cn("capitalize", tx.type === 'deposit' ? 'text-green-600' : 'text-destructive')}>{tx.type}</TableCell>
                                        <TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={3} className="h-24 text-center">No transactions found.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

type SortConfig = {
    key: keyof SavingsItem | 'monthlyAmount';
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

type SavingsTableProps = {
    columnVisibility: ColumnVisibility;
}

const parseDate = (dateString: string): Date => {
    if (!dateString) return new Date();
    const datePart = dateString.split('T')[0];
    return parse(datePart, "yyyy-MM-dd", new Date());
};


export function SavingsTable({ columnVisibility }: SavingsTableProps) {
  const { 
    savingsItems, 
    addSavingsItem, 
    updateSavingsItem, 
    deleteSavingsItem,
    fundSinkingFund,
    withdrawFromSinkingFund,
    isLoading: isLoadingSavings 
  } = useSavings();
  const { categories, isLoading: isLoadingCategories } = useSinkingFundCategories();
  
  const { user } = useUser();
  const { exchangeRate, isLoading: isLoadingRate } = useExchangeRate();
  const { toast } = useToast();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SavingsItem | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
  const [openCategories, setOpenCategories] = useState<string[]>([]);

  const isLoading = isLoadingSavings || isLoadingRate || isLoadingCategories;

  const handleEdit = (item: SavingsItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleFormOpenChange = (isOpen: boolean) => {
    setIsFormOpen(isOpen);
    if (!isOpen) {
      setEditingItem(null);
    }
  };
  
  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev => 
        prev.includes(categoryId) 
            ? prev.filter(id => id !== categoryId)
            : [...prev, categoryId]
    );
  };

  const sortedItems = useMemo(() => {
    let sortableItems = [...savingsItems];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any = a[sortConfig.key as keyof SavingsItem];
        let bValue: any = b[sortConfig.key as keyof SavingsItem];
        
        if (aValue === undefined || aValue === null) aValue = sortConfig.direction === 'ascending' ? Infinity : -Infinity;
        if (bValue === undefined || bValue === null) bValue = sortConfig.direction === 'ascending' ? Infinity : -Infinity;

        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [savingsItems, sortConfig]);

  const groupedAndSortedItems = useMemo(() => {
    const categoryMap = new Map(categories.map(cat => [cat.id, cat.name]));
    const grouped: Record<string, { name: string, items: SavingsItem[] }> = {};

    sortedItems.forEach(item => {
        const categoryId = item.categoryId || 'uncategorized';
        if (!grouped[categoryId]) {
            grouped[categoryId] = {
                name: categoryMap.get(categoryId) || 'Uncategorized',
                items: []
            };
        }
        grouped[categoryId].items.push(item);
    });

    return Object.entries(grouped).sort(([_, a], [__, b]) => a.name.localeCompare(b.name));
  }, [sortedItems, categories]);


  const handleFundItem = async (item: SavingsItem) => {
    if (!user || !item.monthlyAmount) return;
    try {
        await fundSinkingFund(item.id, item.monthlyAmount, user.uid);
        toast({
            title: "Success!",
            description: `${formatCurrency(item.monthlyAmount, item.currency)} was added to "${item.name}".`
        });
    } catch(e) {
        toast({
            title: "Error",
            description: "Failed to fund the sinking fund. Please try again.",
            variant: "destructive",
        });
    }
  }

  const handleWithdraw = async (item: SavingsItem, amount: number) => {
    if (!user) return;
    try {
        await withdrawFromSinkingFund(item.id, amount, user.uid);
        toast({
            title: "Success!",
            description: `${formatCurrency(amount, item.currency)} was withdrawn from "${item.name}".`
        });
    } catch (e) {
        toast({
            title: "Error",
            description: "Failed to withdraw from the sinking fund.",
            variant: "destructive",
        });
    }
  };

  const renderLoadingSkeleton = () => (
    Array.from({ length: 4 }).map((_, i) => (
      <TableRow key={`skeleton-savings-${i}`}>
        <TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const { totalSaved, totalCost, totalSavingsTarget, totalMonthlyContribution } = useMemo(() => {
    const totals = savingsItems.reduce((acc, item) => {
        const rate = exchangeRate || 1.0;
        const savedAmount = item.currency === 'USD' ? item.amount * rate : item.amount;
        const costAmount = item.totalCost ? (item.currency === 'USD' ? item.totalCost * rate : item.totalCost) : 0;
        const targetAmount = item.savingsTarget ? (item.currency === 'USD' ? item.savingsTarget * rate : item.savingsTarget) : 0;

        acc.saved += savedAmount;
        acc.cost += costAmount;
        acc.target += targetAmount;
        
        const monthlyAmt = item.monthlyAmount || 0;
        const convertedAmt = item.currency === 'USD' ? monthlyAmt * rate : monthlyAmt;
        acc.monthly += convertedAmt;
        return acc;
    }, { saved: 0, cost: 0, target: 0, monthly: 0 });

    return {
        totalSaved: totals.saved,
        totalCost: totals.cost,
        totalSavingsTarget: totals.target,
        totalMonthlyContribution: totals.monthly
    };
}, [savingsItems, exchangeRate]);

  return (
    <>
      <SavingsForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addSavingsItem={addSavingsItem}
        updateSavingsItem={updateSavingsItem}
        editingItem={editingItem}
      />
      <div className="flex justify-end items-center mb-6 gap-2">
           <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Fund
          </Button> 
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow className="group">
                {columnVisibility.name && <TableHead className="w-[30%]">Fund Name</TableHead>}
                {columnVisibility.amount && <TableHead className="text-right w-[140px]">Amount Saved</TableHead>}
                {columnVisibility.totalCost && <TableHead className="text-right w-[120px]">Total Cost</TableHead>}
                {columnVisibility.savingsTarget && <TableHead className="text-right w-[120px]">My Target</TableHead>}
                {columnVisibility.dueDate && <TableHead className="text-right w-[140px]">Due Date</TableHead>}
                {columnVisibility.recurrence && <TableHead className="w-[150px]">Recurrence</TableHead>}
                {columnVisibility.monthlyAmount && <TableHead className="text-right w-[160px]">Monthly Amount</TableHead>}
                {columnVisibility.actions && <TableHead className="w-[180px] text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : groupedAndSortedItems.length > 0 ? (
                    groupedAndSortedItems.map(([categoryId, { name, items }]) => (
                        <Collapsible asChild key={categoryId} open={openCategories.includes(categoryId)} onOpenChange={() => toggleCategory(categoryId)}>
                            <>
                            <CollapsibleTrigger asChild>
                                <TableRow className="font-semibold bg-secondary/50 hover:bg-secondary/70 cursor-pointer">
                                    <TableCell colSpan={Object.values(columnVisibility).filter(Boolean).length}>
                                         <div className="flex items-center gap-2">
                                            <ChevronDown className={cn("h-4 w-4 transition-transform", openCategories.includes(categoryId) && "-rotate-180")} />
                                            {name}
                                         </div>
                                    </TableCell>
                                </TableRow>
                            </CollapsibleTrigger>
                            <CollapsibleContent asChild>
                                <>
                                {items.map((item) => {
                                    const costToUse = (item.savingsTarget && item.savingsTarget > 0) ? item.savingsTarget : item.totalCost;
                                    const progress = costToUse && costToUse > 0 ? (item.amount / costToUse) * 100 : 0;
                                    
                                    const monthlyAmount = item.monthlyAmount || 0;
                                    const isUsd = item.currency === 'USD';
                                    const convertedMonthlyAmount = isUsd ? monthlyAmount * (exchangeRate || 1) : monthlyAmount;
                                    
                                    const isFundedThisMonth = item.lastFundedAt ? isSameMonth(new Date(item.lastFundedAt), new Date()) : false;

                                    return (
                                        <TableRow key={item.id}>
                                            {columnVisibility.name && <TableCell className="font-medium pl-10">{item.name}{isUsd && <Badge variant="secondary" className="ml-2">USD</Badge>}</TableCell>}
                                            {columnVisibility.amount && <TableCell className="text-right">{formatCurrency(item.amount, item.currency)}</TableCell>}
                                            {columnVisibility.totalCost && <TableCell className="text-right">
                                                {item.totalCost ? formatCurrency(item.totalCost, item.currency) : '-'}
                                            </TableCell>}
                                            {columnVisibility.savingsTarget && <TableCell className="text-right">
                                                {item.savingsTarget ? formatCurrency(item.savingsTarget, item.currency) : '-'}
                                                {costToUse && costToUse > 0 && (
                                                    <div className="flex items-center justify-end gap-2 mt-1">
                                                        <Progress value={progress} className="w-[60%]" aria-label={`${Math.round(progress)}% funded`} />
                                                        <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
                                                    </div>
                                                )}
                                            </TableCell>}
                                            {columnVisibility.dueDate && <TableCell className="text-right">{item.dueDate ? format(parseDate(item.dueDate), 'PPP') : '-'}</TableCell>}
                                            {columnVisibility.recurrence && <TableCell>
                                                {item.recurrence && item.recurrence !== 'None' ? (
                                                    <Badge variant="secondary" className="gap-1 items-center">
                                                        <Repeat className="h-3 w-3" /> {item.recurrence}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>}
                                            {columnVisibility.monthlyAmount && <TableCell className="text-right">
                                                <div className='flex items-center justify-end gap-1'>
                                                {monthlyAmount > 0 && (
                                                <>
                                                    {formatCurrency(convertedMonthlyAmount)}
                                                    {isUsd && <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground"><Info className="h-3 w-3" /></Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-60 text-xs">
                                                            Original: {formatCurrency(monthlyAmount, 'USD')}. Converted to CAD at a rate of {exchangeRate}.
                                                        </PopoverContent>
                                                    </Popover>}
                                                </>
                                                )}
                                                {monthlyAmount <= 0 && '-'}
                                                </div>
                                            </TableCell>}
                                            {columnVisibility.actions && <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <div className='flex'>
                                                                <TransactionDialog item={item} transactionType="deposit" onSave={(amount) => fundSinkingFund(item.id, amount, user!.uid)}>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700"><DollarSign className="h-4 w-4" /></Button>
                                                                </TransactionDialog>
                                                                <TransactionDialog item={item} transactionType="withdraw" onSave={(amount) => handleWithdraw(item, amount)}>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700"><MinusCircle className="h-4 w-4" /></Button>
                                                                </TransactionDialog>
                                                                {isFundedThisMonth ? (
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500 cursor-default">
                                                                        <CheckCircle className="h-4 w-4" />
                                                                    </Button>
                                                                ) : (
                                                                    <AlertDialog>
                                                                        <AlertDialogTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700" disabled={monthlyAmount <= 0}>
                                                                                <PiggyBank className="h-4 w-4" />
                                                                            </Button>
                                                                        </AlertDialogTrigger>
                                                                        <AlertDialogContent>
                                                                            <AlertDialogHeader>
                                                                                <AlertDialogTitle>Fund Sinking Fund?</AlertDialogTitle>
                                                                                <AlertDialogDescription>
                                                                                    This will add {formatCurrency(monthlyAmount, item.currency)} to your saved amount for &quot;{item.name}&quot;.
                                                                                </AlertDialogDescription>
                                                                            </AlertDialogHeader>
                                                                            <AlertDialogFooter>
                                                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                                <AlertDialogAction onClick={() => handleFundItem(item)}>Confirm</AlertDialogAction>
                                                                            </AlertDialogFooter>
                                                                        </AlertDialogContent>
                                                                    </AlertDialog>
                                                                )}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p>{isFundedThisMonth ? 'Funded this month' : 'Fund Monthly Amount'}</p></TooltipContent>
                                                    </Tooltip>

                                                    <TransactionHistoryDialog fundId={item.id} fundName={item.name} userId={user?.uid || null} />
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /></Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent><p>Edit Fund</p></TooltipContent>
                                                    </Tooltip>
                                                    <AlertDialog>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                                            </TooltipTrigger>
                                                            <TooltipContent><p>Delete Fund</p></TooltipContent>
                                                        </Tooltip>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this savings fund.</AlertDialogDescription></AlertDialogHeader>
                                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteSavingsItem(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>Delete</AlertDialogAction></AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>}
                                        </TableRow>
                                    )
                                })}
                                </>
                            </CollapsibleContent>
                            </>
                        </Collapsible>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={Object.values(columnVisibility).filter(Boolean).length} className="h-24 text-center">
                        No funds created yet. Add one to get started!
                    </TableCell>
                    </TableRow>
                )}
            </TableBody>
            {savingsItems.length > 0 && (
              <TableFooter>
                <TableRow>
                    {columnVisibility.name && <TableCell className="font-semibold text-right">Totals (CAD)</TableCell>}
                    {columnVisibility.amount && <TableCell className="text-right font-semibold">{formatCurrency(totalSaved)}</TableCell>}
                    {columnVisibility.totalCost && <TableCell className="text-right font-semibold">{formatCurrency(totalCost)}</TableCell>}
                    {columnVisibility.savingsTarget && <TableCell className="text-right font-semibold">{formatCurrency(totalSavingsTarget)}</TableCell>}
                    {columnVisibility.dueDate && <TableCell></TableCell>}
                    {columnVisibility.recurrence && <TableCell></TableCell>}
                    {columnVisibility.monthlyAmount && <TableCell className="text-right font-semibold">{formatCurrency(totalMonthlyContribution)}</TableCell>}
                    {columnVisibility.actions && <TableCell></TableCell>}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </TooltipProvider>
      </div>
    </>
  );
}
