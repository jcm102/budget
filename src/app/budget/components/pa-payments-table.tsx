

'use client';

import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2, PlusCircle, Repeat, Info, ChevronsUpDown, ArrowUpDown, RotateCcw } from 'lucide-react';
import type { BudgetItem, Category } from '@/types';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { BudgetForm } from './budget-form';
import { useBudget } from '@/app/budget/hooks/use-budget';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useMonthlyBudget } from '@/app/monthly-budget/hooks/use-monthly-budget';

type SortConfig = {
    key: keyof BudgetItem;
    direction: 'ascending' | 'descending';
} | null;

const parseDate = (dateString: string) => {
    const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
    return new Date(year, month - 1, day);
};

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

export function PaPaymentsTable() {
  const { budgetItems, addBudgetItem, updateBudgetItem, deleteBudgetItem, toggleBudgetItemCompleted, cycleBudgetItems, isLoading } = useBudget();
  const { categories: budgetCategories } = useMonthlyBudget();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'ascending' });

  const paymentItems = useMemo(() => budgetItems.filter(item => item.type === 'Pre-Authorized Payments'), [budgetItems]);

  const categoryMap = useMemo(() => {
    return budgetCategories.reduce((map, category) => {
        map[category.id] = category.name;
        return map;
    }, {} as Record<string, string>);
  }, [budgetCategories]);

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
    let sortableItems = [...paymentItems];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;
        if (sortConfig.key === 'date') {
            aValue = parseDate(a.date).getTime();
            bValue = parseDate(b.date).getTime();
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
  }, [paymentItems, sortConfig]);

  const renderLoadingSkeleton = () => (
    Array.from({ length: 3 }).map((_, i) => (
      <TableRow key={`skeleton-pa-${i}`}>
        <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const total = paymentItems.reduce((acc, item) => acc + item.amount, 0);
  const remainingTotal = paymentItems.filter(item => !item.completed).reduce((acc, item) => acc + item.amount, 0);

  return (
    <>
      <BudgetForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addBudgetItem={addBudgetItem}
        updateBudgetItem={updateBudgetItem}
        editingItem={editingItem}
      />
      <div className="flex justify-between items-center mb-6 gap-2 no-print">
        <div className="flex items-center gap-2">
            <h3 className="text-2xl font-bold font-headline text-primary">Pre-Authorized Payments</h3>
            <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                <Info className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <p className="text-sm">
                    Items that will come out of the chequing account this month.
                </p>
            </PopoverContent>
            </Popover>
        </div>
        <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={paymentItems.length === 0}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Monthly Reset
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will uncheck all paid items and advance their dates to the next month based on their frequency. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => cycleBudgetItems()} className={cn(buttonVariants({ variant: "default" }))}>
                    Yes, Reset Payments
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Budget Item
            </Button>
        </div>
      </div>

       <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow className="group">
                        <TableHead className="w-[50px]">Paid</TableHead>
                        <SortableHeader column="description" label="Description" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader column="date" label="Date" sortConfig={sortConfig} requestSort={requestSort} />
                        <TableHead>Budget Category</TableHead>
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
                    <TableRow key={item.id} data-state={item.completed ? "completed" : "" } className={cn(item.completed && "bg-accent/30 text-muted-foreground")}>
                        <TableCell>
                            <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => toggleBudgetItemCompleted(item.id, item.completed || false)}
                            aria-label={`Mark ${item.description} as paid`}
                            />
                        </TableCell>
                        <TableCell className={cn("font-medium", item.completed && "line-through")}>{item.description}</TableCell>
                        <TableCell>{format(parseDate(item.date), 'PPP')}</TableCell>
                        <TableCell>{item.budgetCategoryId ? categoryMap[item.budgetCategoryId] : <span className="text-muted-foreground">N/A</span>}</TableCell>
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
                    <TableCell colSpan={7} className="h-24 text-center">
                        No pre-authorized payments added yet.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
                {sortedItems.length > 0 && (
                    <TableFooter>
                            <TableRow>
                                <TableCell colSpan={5} className="font-semibold text-right">Remaining</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(remainingTotal)}</TableCell>
                                <TableCell />
                            </TableRow>
                            <TableRow>
                                <TableCell colSpan={5} className="font-semibold text-right">Total</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(total)}</TableCell>
                                <TableCell />
                            </TableRow>
                    </TableFooter>
                )}
            </Table>
        </div>
    </>
  );
}
