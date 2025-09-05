
'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2, PlusCircle, Repeat, Info, ChevronsUpDown, ArrowUpDown, RefreshCw } from 'lucide-react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { BudgetForm } from './budget-form';
import { useBudget } from '@/hooks/use-budget';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';
import { Checkbox } from './ui/checkbox';
import * as BudgetService from '@/services/budget-service';
import { useToast } from '@/hooks/use-toast';


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
  const { budgetItems, addBudgetItem, updateBudgetItem, deleteBudgetItem, toggleBudgetItemCompleted, fetchBudgetItems, isLoading } = useBudget();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'ascending' });
  const { toast } = useToast();


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
        <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const total = debtItems.reduce((acc, item) => acc + item.amount, 0);

  const handleSync = async () => {
    try {
      await BudgetService.syncDebtPayments();
      await fetchBudgetItems();
      toast({
        title: 'Success!',
        description: 'Debt payments have been synced from the Debt Worksheet.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not sync debt payments.',
        variant: 'destructive',
      });
    }
  };

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
            <h3 className="text-2xl font-bold font-headline text-primary">Debt Payments</h3>
             <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                <Info className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
                <p className="text-sm">
                   Payments automatically populated from the "Actual Payment" column in the Debt Worksheet. Click "Sync from Worksheet" to update.
                </p>
            </PopoverContent>
            </Popover>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSync}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync from Worksheet
            </Button>
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
                        <SortableHeader column="transferFrom" label="Payment Source" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader column="date" label="Date" sortConfig={sortConfig} requestSort={requestSort} />
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
                        <TableCell>{item.transferFrom}</TableCell>
                        <TableCell>{format(new Date(item.date), 'PPP')}</TableCell>
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
                    <TableCell colSpan={6} className="h-24 text-center">
                        No debt payments found. Sync from the Debt Worksheet to populate this list.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
                {sortedItems.length > 0 && (
                    <TableFooter>
                            <TableRow>
                                <TableCell colSpan={4} className="font-semibold text-right">Total</TableCell>
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
