
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Pencil, Trash2, PlusCircle, DollarSign, ArrowUpDown, Link as LinkIcon, MinusCircle } from 'lucide-react';
import type { Goal } from '@/types';
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
import { GoalForm } from './goal-form';
import { useGoals } from '@/hooks/use-goals';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';
import { Card, CardContent } from './ui/card';


const transactionSchema = z.object({
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero.'),
});

function TransactionDialog({ goal, transactionType, onSave, children }: { goal: Goal, transactionType: 'deposit' | 'withdraw', onSave: (amount: number) => void, children: React.ReactNode }) {
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
                    <DialogTitle>{transactionType === 'deposit' ? 'Deposit to' : 'Withdraw from'} "{goal.name}"</DialogTitle>
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
    key: keyof Goal;
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

export function GoalTable() {
  const { goals, addGoal, updateGoal, deleteGoal, isLoading } = useGoals();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Goal | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });

  const handleEdit = (item: Goal) => {
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

  const requestSort = (key: SortConfig['key']) => {
    if (!key) return;
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const sortedItems = useMemo(() => {
    let sortableItems = [...goals];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any, bValue: any;
        aValue = a[sortConfig.key as keyof Goal];
        bValue = b[sortConfig.key as keyof Goal];

        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [goals, sortConfig]);
  
  const handleTransaction = (goal: Goal, amount: number, type: 'deposit' | 'withdraw') => {
    const currentAmount = goal.amount;
    const newAmount = type === 'deposit' ? currentAmount + amount : currentAmount - amount;
    updateGoal(goal.id, { amount: newAmount < 0 ? 0 : newAmount });
  };


  const renderLoadingSkeleton = () => (
    Array.from({ length: 2 }).map((_, i) => (
      <TableRow key={`skeleton-goal-${i}`}>
        <TableCell colSpan={3}><Skeleton className="h-10 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const totalAllocated = goals.reduce((acc, goal) => acc + goal.amount, 0);

  return (
    <>
      <GoalForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addGoal={addGoal}
        updateGoal={updateGoal}
        editingItem={editingItem}
      />
      <div className="flex justify-end items-center mb-6 gap-2">
          <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Pot
          </Button>
      </div>

      <Card className="mb-8">
        <CardContent className="p-4 flex justify-center">
            <div className="flex items-center gap-4">
                <DollarSign className="h-8 w-8 text-green-500" />
                <div>
                    <p className="text-muted-foreground">Total Allocated</p>
                    <p className="text-xl font-semibold">{formatCurrency(totalAllocated)}</p>
                </div>
            </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="group">
                <SortableHeader column="name" label="Pot Name" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader column="amount" label="Amount" sortConfig={sortConfig} requestSort={requestSort} className="text-right"/>
                <TableHead className="w-[180px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : sortedItems.length > 0 ? (
                    sortedItems.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium flex items-center gap-2">
                                {item.name}
                                {item.url && (
                                    <Button asChild variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">
                                        <Link href={item.url} target="_blank" rel="noopener noreferrer">
                                            <LinkIcon className="h-4 w-4" />
                                        </Link>
                                    </Button>
                                )}
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                    <TransactionDialog goal={item} transactionType='deposit' onSave={(amount) => handleTransaction(item, amount, 'deposit')}>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700"><PlusCircle className="h-4 w-4" /></Button>
                                    </TransactionDialog>
                                    <TransactionDialog goal={item} transactionType='withdraw' onSave={(amount) => handleTransaction(item, amount, 'withdraw')}>
                                         <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700"><MinusCircle className="h-4 w-4" /></Button>
                                    </TransactionDialog>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /></Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this savings pot.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteGoal(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>Delete</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                        No pots created yet. Add one to get started!
                    </TableCell>
                    </TableRow>
                )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold text-right">Total</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totalAllocated)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
      </div>
    </>
  );
}
