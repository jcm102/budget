
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Pencil, Trash2, PlusCircle, ArrowUpDown, DollarSign, MinusCircle, Info, ChevronDown, MoreHorizontal } from 'lucide-react';
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
import { useSavings } from '../hooks/use-savings';
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


const transactionSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero.'),
});

const formatCurrency = (amount: number, currency: 'CAD' | 'USD' = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

function TransactionDialog({ item, transactionType, onSave, children }: { item: SavingsItem, transactionType: 'deposit' | 'withdraw', onSave: (amount: number) => void, children: React.ReactNode }) {
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
    key: keyof SavingsItem | 'monthlyAmount' | 'progress';
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

function FundsTable({ 
    items, 
    sortConfig, 
    requestSort,
    handleEdit, 
    handleTransaction, 
    deleteSavingsItem,
    exchangeRate 
} : {
    items: SavingsItem[],
    sortConfig: SortConfig,
    requestSort: (key: any) => void,
    handleEdit: (item: SavingsItem) => void,
    handleTransaction: (item: SavingsItem, amount: number, type: 'deposit' | 'withdraw') => void,
    deleteSavingsItem: (id: string) => void,
    exchangeRate: number | null
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
    
    const [openDialog, setOpenDialog] = useState<'deposit' | 'withdraw' | 'delete' | null>(null);
    const [currentItem, setCurrentItem] = useState<SavingsItem | null>(null);

    const handleActionClick = (item: SavingsItem, action: 'deposit' | 'withdraw' | 'edit' | 'delete') => {
        setCurrentItem(item);
        if (action === 'edit') {
            handleEdit(item);
        } else {
            setOpenDialog(action);
        }
    };
    
    const onDialogSave = (amount: number) => {
        if (currentItem && openDialog) {
            handleTransaction(currentItem, amount, openDialog as 'deposit' | 'withdraw');
        }
    }
    
    const totals = useMemo(() => {
        return items.reduce((acc, item) => {
            acc.balance += item.amount;
            acc.goal += item.totalCost || 0;
            acc.monthly += item.monthlyAmount || 0;
            return acc;
        }, { balance: 0, goal: 0, monthly: 0 });
    }, [items]);


    return (
        <>
            {currentItem && (
                <>
                 <TransactionDialog
                    item={currentItem}
                    transactionType="deposit"
                    onSave={onDialogSave}
                  >
                    {/* This is a placeholder, the dialog is controlled externally */}
                    <div data-state={openDialog === 'deposit' ? 'open' : 'closed'} />
                </TransactionDialog>
                <TransactionDialog
                    item={currentItem}
                    transactionType="withdraw"
                    onSave={onDialogSave}
                >
                    <div data-state={openDialog === 'withdraw' ? 'open' : 'closed'} />
                </TransactionDialog>
                 <AlertDialog open={openDialog === 'delete'} onOpenChange={(isOpen) => !isOpen && setOpenDialog(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete this sinking fund and all its transaction history.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setOpenDialog(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => { deleteSavingsItem(currentItem.id); setOpenDialog(null); }} className={cn(buttonVariants({ variant: "destructive" }))}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                </>
            )}
        <Table>
            <TableHeader>
                <TableRow className="group">
                    <SortableHeader column="name" label="Fund Name" sortConfig={sortConfig} requestSort={requestSort} />
                    <SortableHeader column="amount" label="Balance" sortConfig={sortConfig} requestSort={requestSort} className="text-right"/>
                    <SortableHeader column="totalCost" label="Total Goal" sortConfig={sortConfig} requestSort={requestSort} className="text-right"/>
                    <SortableHeader column="progress" label="Progress" sortConfig={sortConfig} requestSort={requestSort}/>
                    <SortableHeader column="monthlyAmount" label="Monthly Contribution" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                    <SortableHeader column="dueDate" label="Due Date" sortConfig={sortConfig} requestSort={requestSort}/>
                    <TableHead>
                        <div className="flex items-center gap-1">
                            CAD Contr.
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
                    <TableHead className="w-[50px] text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedItems.map((item) => {
                    const progress = item.totalCost && item.totalCost > 0 ? (item.amount / item.totalCost) * 100 : 0;
                    const cadContribution = item.currency === 'USD' && item.monthlyAmount && exchangeRate ? item.monthlyAmount * exchangeRate : null;
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
                        <TableCell className="text-right">
                             <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleActionClick(item, 'deposit')}>
                                        <DollarSign className="mr-2 h-4 w-4" /> Deposit
                                    </DropdownMenuItem>
                                     <DropdownMenuItem onClick={() => handleActionClick(item, 'withdraw')}>
                                        <MinusCircle className="mr-2 h-4 w-4" /> Withdraw
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleActionClick(item, 'edit')}>
                                        <Pencil className="mr-2 h-4 w-4" /> Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => handleActionClick(item, 'delete')} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
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
        </>
    )
}

export function SinkingFundTable() {
  const { savingsItems, addSavingsItem, updateSavingsItem, deleteSavingsItem, fundSinkingFund, withdrawFromSinkingFund, isLoading } = useSavings();
  const { categories, isLoading: isLoadingCategories } = useSinkingFundCategories();
  const { user } = useUser();
  const { toast } = useToast();
  const { exchangeRate } = useExchangeRate();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SavingsItem | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
  
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
  
  const requestSort = (key: SortConfig['key']) => {
    if (!key) return;
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const handleTransaction = async (item: SavingsItem, amount: number, type: 'deposit' | 'withdraw') => {
    if (!user) return;
    try {
        if (type === 'deposit') {
            await fundSinkingFund(item.id, amount, user.uid);
            toast({ title: "Success!", description: `${formatCurrency(amount)} deposited to "${item.name}".`});
        } else {
            await withdrawFromSinkingFund(item.id, amount, user.uid);
            toast({ title: "Success!", description: `${formatCurrency(amount)} withdrawn from "${item.name}".`});
        }
    } catch (error: any) {
        toast({ title: 'Error', description: error.message || 'Transaction failed.', variant: 'destructive'});
    }
  };


  const renderLoadingSkeleton = () => (
    Array.from({ length: 4 }).map((_, i) => (
      <Skeleton key={`skeleton-fund-${i}`} className="h-10 w-full" />
    ))
  );

  const totalMonthlyContribution = savingsItems.reduce((acc, item) => acc + (item.monthlyAmount || 0), 0);
  
  const groupedFunds = useMemo(() => {
    const groupMap: Record<string, { category: Category | null, items: SavingsItem[] }> = {};

    savingsItems.forEach(item => {
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

  }, [savingsItems, categories]);


  return (
    <>
      <SinkingFundForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addSavingsItem={addSavingsItem}
        updateSavingsItem={updateSavingsItem}
        editingItem={editingItem}
      />
      <div className="flex justify-end items-center mb-6 gap-2">
          <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Sinking Fund
          </Button>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
         {isLoading || isLoadingCategories ? (
            <div className="p-4 space-y-4">
              {renderLoadingSkeleton()}
            </div>
         ) : savingsItems.length > 0 ? (
            <Accordion type="multiple" className="w-full" defaultValue={groupedFunds.map(g => g.category?.id || 'uncategorized')}>
              {groupedFunds.map(({ category, items }) => {
                const categoryTotalMonthly = items.reduce((sum, item) => sum + (item.monthlyAmount || 0), 0);
                return (
                  <AccordionItem key={category?.id || 'uncategorized'} value={category?.id || 'uncategorized'}>
                    <AccordionTrigger className="px-4 py-2 hover:bg-muted/50">
                        <div className="flex justify-between items-center w-full">
                            <span className="font-semibold text-lg">{category?.name || 'Uncategorized'}</span>
                            <span className="text-muted-foreground text-base">{formatCurrency(categoryTotalMonthly)} / month</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-0">
                       <FundsTable 
                         items={items}
                         sortConfig={sortConfig}
                         requestSort={requestSort}
                         handleEdit={handleEdit}
                         handleTransaction={handleTransaction}
                         deleteSavingsItem={deleteSavingsItem}
                         exchangeRate={exchangeRate}
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
          {savingsItems.length > 0 && !isLoading && (
            <div className="p-4 border-t flex justify-end items-center font-semibold text-lg">
                <span className="text-muted-foreground mr-4">Total Monthly Contribution:</span>
                <span>{formatCurrency(totalMonthlyContribution)}</span>
            </div>
          )}
      </div>
    </>
  );
}

