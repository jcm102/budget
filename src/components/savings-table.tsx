
'use client';

import { useState, useMemo } from 'react';
import type { SavingsItem, Goal, SubscriptionItem, AutoShipItem } from '@/types';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format, differenceInMonths, addMonths } from 'date-fns';

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
import { SavingsForm } from './savings-form';
import { useSavings } from '@/hooks/use-savings';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';
import { Pencil, Trash2, PlusCircle, ArrowUpDown, DollarSign, MinusCircle, Info } from 'lucide-react';
import { Progress } from './ui/progress';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';

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
        {isSorted && <ArrowUpDown className={'ml-2 h-4 w-4 transform ${direction === \'descending\' ? \'rotate-180\' : \'\'}'} />}
        {!isSorted && <ArrowUpDown className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-50" />}
      </Button>
    </TableHead>
  )
}

const getNextBillingDate = (item: SubscriptionItem | AutoShipItem): Date => {
    if ('nextShipmentDate' in item) { // It's an AutoShipItem
        return new Date(item.nextShipmentDate);
    }
    // It's a SubscriptionItem
    const today = new Date();
    const monthsToAdd = { 'Monthly': 1, 'Quarterly': 3, 'Annually': 12 };
    // This is a simplification; for a real app, you'd store the initial subscription date.
    // For now, we'll just project from today.
    return addMonths(today, monthsToAdd[item.billingFrequency]);
}

export function SavingsTable() {
  const { 
    savingsItems, 
    goals,
    subscriptions,
    autoShipItems,
    addSavingsItem, 
    updateSavingsItem, 
    deleteSavingsItem, 
    isLoading 
  } = useSavings();

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };
  
  const calculateMonthlyAmount = (totalCost: number, amountSaved: number, dueDate: Date): number => {
      const today = new Date();
      const monthsRemaining = differenceInMonths(dueDate, today);
      
      // Fully funded by the month before it's due.
      const planningMonths = monthsRemaining > 0 ? monthsRemaining : 1; 
      const remainingAmount = totalCost - amountSaved;
      
      return remainingAmount > 0 ? remainingAmount / planningMonths : 0;
  };

  const enhancedSavingsItems = useMemo(() => {
    return savingsItems.map(item => {
        const goal = goals.find(g => g.name.toLowerCase() === item.name.toLowerCase());
        if (goal) {
            return {
                ...item,
                totalCost: goal.cost,
            };
        }
        
        const subscription = subscriptions.find(s => s.serviceName.toLowerCase() === item.name.toLowerCase());
        if (subscription) {
            const dueDate = getNextBillingDate(subscription);
            return {
                ...item,
                totalCost: subscription.cost,
                dueDate: dueDate.toISOString(),
                monthlyAmount: calculateMonthlyAmount(subscription.cost, item.amount, dueDate),
            };
        }
        
        const autoShip = autoShipItems.find(a => a.item.toLowerCase() === item.name.toLowerCase());
        if (autoShip) {
            const dueDate = getNextBillingDate(autoShip);
            return {
                ...item,
                totalCost: autoShip.estimatedCost,
                dueDate: dueDate.toISOString(),
                monthlyAmount: calculateMonthlyAmount(autoShip.estimatedCost, item.amount, dueDate),
            };
        }

        return item; // It's a generic fund
    });
  }, [savingsItems, goals, subscriptions, autoShipItems]);

  const requestSort = (key: SortConfig['key']) => {
    if (!key) return;
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const sortedItems = useMemo(() => {
    let sortableItems = [...enhancedSavingsItems];
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
  }, [enhancedSavingsItems, sortConfig]);

  const handleTransaction = (item: SavingsItem, amount: number, type: 'deposit' | 'withdraw') => {
    const currentAmount = item.amount;
    const newAmount = type === 'deposit' ? currentAmount + amount : currentAmount - amount;
    updateSavingsItem(item.id, { amount: newAmount < 0 ? 0 : newAmount });
  };

  const renderLoadingSkeleton = () => (
    Array.from({ length: 4 }).map((_, i) => (
      <TableRow key={`skeleton-savings-${i}`}>
        <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const totalAmount = savingsItems.reduce((acc, item) => acc + item.amount, 0);
  const totalMonthlyContribution = sortedItems.reduce((acc, item) => acc + (item.monthlyAmount || item.goal || 0), 0);

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
          <Table>
            <TableHeader>
              <TableRow className="group">
                <SortableHeader column="name" label="Fund Name" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader column="amount" label="Amount Saved" sortConfig={sortConfig} requestSort={requestSort} className="text-right"/>
                <SortableHeader column="totalCost" label="Total Cost" sortConfig={sortConfig} requestSort={requestSort} className="text-right"/>
                <SortableHeader column="dueDate" label="Due Date" sortConfig={sortConfig} requestSort={requestSort} className="text-right"/>
                <SortableHeader column="monthlyAmount" label="Monthly Amount" sortConfig={sortConfig} requestSort={requestSort} className="text-right"/>
                <TableHead className="w-[180px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : sortedItems.length > 0 ? (
                    sortedItems.map((item) => {
                        const progress = item.totalCost && item.totalCost > 0 ? (item.amount / item.totalCost) * 100 : 0;
                        return (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                            <TableCell className="text-right">
                                {item.totalCost ? formatCurrency(item.totalCost) : '-'}
                                {item.totalCost && item.totalCost > 0 && (
                                    <div className="flex items-center justify-end gap-2 mt-1">
                                         <Progress value={progress} className="w-[60%]" aria-label={`${Math.round(progress)}% funded`} />
                                         <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
                                    </div>
                                )}
                            </TableCell>
                             <TableCell className="text-right">{item.dueDate ? format(new Date(item.dueDate), 'PPP') : '-'}</TableCell>
                            <TableCell className="text-right">
                                <div className='flex items-center justify-end gap-1'>
                                {item.monthlyAmount ? formatCurrency(item.monthlyAmount) : (item.goal ? formatCurrency(item.goal) : '-')}
                                {item.monthlyAmount && (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground"><Info className="h-3 w-3" /></Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-60 text-xs">
                                            This is the calculated amount needed each month to be fully funded one month before the due date.
                                        </PopoverContent>
                                    </Popover>
                                )}
                                </div>
                            </TableCell>
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
                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this savings fund.</AlertDialogDescription></AlertDialogHeader>
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
                    <TableCell colSpan={6} className="h-24 text-center">
                        No funds created yet. Add one to get started!
                    </TableCell>
                    </TableRow>
                )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold text-right">Total Saved</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totalAmount)}</TableCell>
                <TableCell colSpan={2} className="font-semibold text-right">Total Monthly Contribution</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totalMonthlyContribution)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
      </div>
    </>
  );
}

