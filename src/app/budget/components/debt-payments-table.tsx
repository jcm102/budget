

'use client';

import { useState, useMemo } from 'react';
import { format, parse } from 'date-fns';
import { Pencil, Trash2, PlusCircle, Repeat, Info, ChevronsUpDown, ArrowUpDown, RefreshCw, Trash } from 'lucide-react';
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
import { BudgetForm } from '@/app/budget/components/budget-form';
import { useBudget } from '@/app/budget/hooks/use-budget';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import * as BudgetService from '@/app/budget/services/budget-service';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

type SortConfig = {
    key: keyof BudgetItem;
    direction: 'ascending' | 'descending';
} | null;

const parseDate = (dateString: string) => {
    return parse(dateString.split('T')[0], 'yyyy-MM-dd', new Date());
};

const SortableHeader = ({ column, label, sortConfig, requestSort, className }: { column: keyof BudgetItem, label: string, sortConfig: SortConfig, requestSort: (key: keyof BudgetItem) => void, className?: string }) => {
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

function PaymentsTableContent({ items, isLoading, onEdit, onDelete, onToggleCompleted, onSync, syncLabel, showSync }: { 
    items: BudgetItem[], 
    isLoading: boolean, 
    onEdit: (item: BudgetItem) => void, 
    onDelete: (id: string) => void, 
    onToggleCompleted: (id: string, completed: boolean) => void,
    onSync: () => void,
    syncLabel: string,
    showSync: boolean
}) {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'ascending' });

    const requestSort = (key: keyof BudgetItem) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedItems = useMemo(() => {
        let sortableItems = [...items];
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
    }, [items, sortConfig]);
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const renderLoadingSkeleton = () => (
        Array.from({ length: 3 }).map((_, i) => (
        <TableRow key={`skeleton-debt-${i}`}>
            <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
        </TableRow>
        ))
    );

    const total = items.reduce((acc, item) => acc + item.amount, 0);
    const remainingTotal = items.filter(item => !item.completed).reduce((acc, item) => acc + item.amount, 0);

    return (
        <div className="space-y-4">
            {showSync && (
                 <div className="flex justify-end items-center gap-2 no-print">
                    <Button onClick={onSync} >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        {syncLabel}
                    </Button>
                </div>
            )}
             <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="group">
                            <TableHead className="w-[50px]">Paid</TableHead>
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
                        <TableRow key={item.id} data-state={item.completed ? "completed" : "" } className={cn(item.completed && "bg-accent/30 text-muted-foreground")}>
                            <TableCell>
                                <Checkbox
                                checked={item.completed}
                                onCheckedChange={() => onToggleCompleted(item.id, item.completed || false)}
                                aria-label={'Mark ${item.description} as paid'}
                                />
                            </TableCell>
                            <TableCell className={cn("font-medium", item.completed && "line-through")}>{item.description}</TableCell>
                            <TableCell>{format(parseDate(item.date), 'PPP')}</TableCell>
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
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)}>
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
                                    <AlertDialogAction onClick={() => onDelete(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
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
                            No debt payments added yet.
                        </TableCell>
                        </TableRow>
                    )}
                    </TableBody>
                    {sortedItems.length > 0 && (
                        <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={4} className="font-semibold text-right">Remaining</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(remainingTotal)}</TableCell>
                                    <TableCell />
                                </TableRow>
                                <TableRow>
                                    <TableCell colSpan={4} className="font-semibold text-right">Total</TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(total)}</TableCell>
                                    <TableCell />
                                </TableRow>
                        </TableFooter>
                    )}
                </Table>
            </div>
        </div>
    )
}


export function DebtPaymentsTable() {
  const { budgetItems, addBudgetItem, updateBudgetItem, deleteBudgetItem, toggleBudgetItemCompleted, isLoading, fetchBudgetItems } = useBudget();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const { toast } = useToast();

  const handleSyncFromWorksheet = async (forNextMonth: boolean) => {
    try {
        await BudgetService.syncDebtPaymentsFromWorksheet(forNextMonth);
        if (forNextMonth) {
            await BudgetService.syncDebtPaymentsToMonthlyBudget();
        }
        await fetchBudgetItems();
        toast({
            title: "Success!",
            description: "Debt payments have been synced from the worksheet."
        })
    } catch (error) {
        console.error('Failed to sync from worksheet:', error);
         toast({
            title: "Error",
            description: "Could not sync debt payments from the worksheet.",
            variant: "destructive"
        })
    }
  };

  const currentMonthItems = useMemo(() => budgetItems.filter(item => item.type === 'Debt Payments' && !item.forNextMonth), [budgetItems]);
  const nextMonthItems = useMemo(() => budgetItems.filter(item => item.type === 'Debt Payments' && item.forNextMonth), [budgetItems]);

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
                   Items that will come out of the chequing account this month.
                </p>
            </PopoverContent>
            </Popover>
        </div>
      </div>
      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50 mb-6 no-print">
            <TabsTrigger value="current">Current Month</TabsTrigger>
            <TabsTrigger value="next">Next Month</TabsTrigger>
        </TabsList>
        <TabsContent value="current">
            <PaymentsTableContent
                items={currentMonthItems}
                isLoading={isLoading}
                onEdit={handleEdit}
                onDelete={deleteBudgetItem}
                onToggleCompleted={toggleBudgetItemCompleted}
                onSync={() => handleSyncFromWorksheet(false)}
                syncLabel="Sync From Debt Worksheet"
                showSync={true}
            />
        </TabsContent>
        <TabsContent value="next">
             <PaymentsTableContent
                items={nextMonthItems}
                isLoading={isLoading}
                onEdit={handleEdit}
                onDelete={deleteBudgetItem}
                onToggleCompleted={toggleBudgetItemCompleted}
                onSync={() => handleSyncFromWorksheet(true)}
                syncLabel="Sync Next Month From Debt Worksheet"
                showSync={true}
            />
        </TabsContent>
      </Tabs>
    </>
  );
}
