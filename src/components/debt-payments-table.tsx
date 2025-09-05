
'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2, PlusCircle, Repeat, ChevronsUpDown, ArrowUpDown, RotateCcw } from 'lucide-react';
import type { BudgetItem } from '@/types';
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
import { BudgetForm } from './budget-form';
import { useBudget } from '@/hooks/use-budget';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';
import { Badge } from './ui/badge';

type SortConfig = {
    key: keyof BudgetItem;
    direction: 'ascending' | 'descending';
} | null;

const SortableHeader = ({ column, label, sortConfig, requestSort, className }: { column: keyof BudgetItem, label: string, sortConfig: SortConfig, requestSort: (key: keyof BudgetItem) => void, className?: string }) => {
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

export function DebtPaymentsTable() {
  const { budgetItems, addBudgetItem, updateBudgetItem, deleteBudgetItem, isLoading } = useBudget();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'ascending' });

  const debtItems = useMemo(() => budgetItems.filter(item => item.type === 'Debt Payments'), [budgetItems]);

  const handleEdit = (item: BudgetItem) => {
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
  
  const requestSort = (key: keyof BudgetItem) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedItems = useMemo(() => {
    let sortableItems = [...debtItems];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;
        if (sortConfig.key === 'date') {
            aValue = new Date(a.date).getTime();
            bValue = new Date(b.date).getTime();
        } else {
            aValue = a[sortConfig.key as keyof BudgetItem];
            bValue = b[sortConfig.key as keyof BudgetItem];
        }
        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [debtItems, sortConfig]);

  const renderLoadingSkeleton = () => (
    Array.from({ length: 3 }).map((_, i) => (
      <TableRow key={`skeleton-debt-${i}`}>
        <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const total = debtItems.reduce((acc, item) => acc + item.amount, 0);

  return (
    <>
      <BudgetForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addBudgetItem={addBudgetItem}
        updateBudgetItem={updateBudgetItem}
        editingItem={editingItem}
      />
      <div className="flex justify-end items-center mb-6 gap-2 no-print">
        <Button onClick={() => setIsFormOpen(true)}>
          <PlusCircle className="mr-2 h-5 w-5" />
          Add Budget Item
        </Button>
      </div>

       <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow className="group">
                        <SortableHeader column="description" label="Description" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader column="date" label="Date" sortConfig={sortConfig} requestSort={requestSort} />
                        <TableHead>Frequency</TableHead>
                        <SortableHeader column="amount" label="Amount" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                        <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : sortedItems.length > 0 ? (
                    sortedItems.map((item) => (
                    <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.description}</TableCell>
                        <TableCell>{format(new Date(item.date), 'PPP')}</TableCell>
                        <TableCell>
                        {item.frequency !== 'One-Time' ? (
                            <Badge variant="secondary" className="gap-1 items-center">
                            <Repeat className="h-3 w-3" /> {item.frequency}
                            </Badge>
                        ) : (
                            <Badge variant="outline">One-Time</Badge>
                        )}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                        <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}>
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
                                    This will permanently delete this budget item.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteBudgetItem(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
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
                        No debt payments added yet.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={3}></TableCell>
                        <TableCell className="font-semibold text-right">Total</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(total)}</TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    </>
  );
}
