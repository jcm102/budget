

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { Pencil, Trash2, PlusCircle, ArrowUpDown, DollarSign, MinusCircle, Info } from 'lucide-react';
import type { SavingsItem } from '@/types';
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

export function SinkingFundTable() {
  const { savingsItems, addSavingsItem, updateSavingsItem, deleteSavingsItem, fundSinkingFund, withdrawFromSinkingFund, isLoading } = useSavings();
  const { categories, isLoading: isLoadingCategories } = useSinkingFundCategories();
  const { user } = useUser();
  const { toast } = useToast();
  const { exchangeRate } = useExchangeRate();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SavingsItem | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
  
  const categoryMap = useMemo(() => {
    return categories.reduce((map, cat) => {
        map[cat.id] = cat.name;
        return map;
    }, {} as Record<string, string>);
  }, [categories]);

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
  
  const sortedItems = useMemo(() => {
    let sortableItems = [...savingsItems];
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
  }, [savingsItems, sortConfig]);

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
      <TableRow key={`skeleton-fund-${i}`}>
        <TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const totalMonthlyContribution = savingsItems.reduce((acc, item) => acc + (item.monthlyAmount || 0), 0);

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
          <Table>
            <TableHeader>
              <TableRow className="group">
                <SortableHeader column="name" label="Fund Name" sortConfig={sortConfig} requestSort={requestSort} />
                <TableHead>Category</TableHead>
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
                <TableHead className="w-[180px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : sortedItems.length > 0 ? (
                    sortedItems.map((item) => {
                        const progress = item.totalCost && item.totalCost > 0 ? (item.amount / item.totalCost) * 100 : 0;
                        const cadContribution = item.currency === 'USD' && item.monthlyAmount && exchangeRate ? item.monthlyAmount * exchangeRate : null;
                        return (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">
                                <Link href={`/sinking-funds/${item.id}`} className="hover:underline">{item.name}</Link>
                                {item.currency === 'USD' && <span className="text-xs text-muted-foreground ml-2">USD</span>}
                            </TableCell>
                            <TableCell>{item.categoryId ? categoryMap[item.categoryId] : '-'}</TableCell>
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
                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this sinking fund and all its transaction history.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteSavingsItem(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>Delete</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </TableCell>
                        </TableRow>
                        )
                    })
                ) : (
                    <TableRow>
                    <TableCell colSpan={9} className="h-24 text-center">
                        No sinking funds created yet. Add one to get started!
                    </TableCell>
                    </TableRow>
                )}
            </TableBody>
            {savingsItems.length > 0 && (
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={5} className="font-semibold text-right">Total Monthly Contribution</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(totalMonthlyContribution)}</TableCell>
                        <TableCell colSpan={3}></TableCell>
                    </TableRow>
                </TableFooter>
            )}
          </Table>
      </div>
    </>
  );
}
