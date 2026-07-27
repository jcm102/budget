'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, parse, addMonths } from 'date-fns';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMonthlyBudget } from '@/app/monthly-budget/hooks/use-monthly-budget';

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
        {isSorted && <ArrowUpDown className={`ml-2 h-4 w-4 transform ${direction === 'descending' ? 'rotate-180' : ''}`} />}
        {!isSorted && <ArrowUpDown className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-50" />}
      </Button>
    </TableHead>
  )
}

type PaymentsTableContentProps = {
    items: BudgetItem[];
    isLoading: boolean;
    onEdit: (item: BudgetItem) => void;
    onDelete: (id: string, deleteType?: 'instance' | 'pattern') => void;
    onToggleCompleted: (id: string, completed: boolean) => void;
    categoryMap: Record<string, string>;
};

function PaymentsTableContent({ items, isLoading, onEdit, onDelete, onToggleCompleted, categoryMap }: PaymentsTableContentProps) {
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);
    const [deletingItem, setDeletingItem] = useState<BudgetItem | null>(null);

    const sortedItems = useMemo(() => {
        let sortableItems = [...items];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                if (sortConfig.key === 'date') {
                    aVal = parseDate(a.date as string).getTime();
                    bVal = parseDate(b.date as string).getTime();
                }

                if (aVal === undefined || aVal === null) return 1;
                if (bVal === undefined || bVal === null) return -1;

                if (aVal < bVal) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aVal > bVal) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [items, sortConfig]);

    const requestSort = (key: keyof BudgetItem) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const renderLoadingSkeleton = () => (
        Array.from({ length: 3 }).map((_, i) => (
            <TableRow key={`skeleton-${i}`}>
                <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
            </TableRow>
        ))
    );

    const total = items.reduce((acc, item) => acc + item.amount, 0);
    const remainingTotal = items.filter(item => !item.completed).reduce((acc, item) => acc + item.amount, 0);

    const handleDeleteInstance = () => {
        if (deletingItem) {
            onDelete(deletingItem.id, 'instance');
            setDeletingItem(null);
        }
    };

    const handleDeletePattern = () => {
        if (deletingItem) {
            onDelete(deletingItem.id, 'pattern');
            setDeletingItem(null);
        }
    };

    const handleDeleteOneTime = () => {
        if (deletingItem) {
            onDelete(deletingItem.id);
            setDeletingItem(null);
        }
    };

    return (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">Paid</TableHead>
                            <SortableHeader column="description" label="Description" sortConfig={sortConfig} requestSort={requestSort} />
                            <TableHead>Category</TableHead>
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
                                aria-label={`Mark ${item.description} as paid`}
                                />
                            </TableCell>
                            <TableCell className={cn("font-medium", item.completed && "line-through")}>{item.description}</TableCell>
                            <TableCell>{item.budgetCategoryId ? categoryMap[item.budgetCategoryId] || 'Uncategorized' : 'Uncategorized'}</TableCell>
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
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={() => setDeletingItem(item)}>
                                <Trash2 className="h-4 w-4" />
                                </Button>
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

            <Dialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
                <DialogContent className="sm:max-w-md">
                    {deletingItem && (
                        <>
                            <DialogHeader>
                                <DialogTitle>
                                    {deletingItem.id.includes('-') ? "Delete Recurring Item" : "Delete Pre-Authorized Payment"}
                                </DialogTitle>
                                <DialogDescription>
                                    {deletingItem.id.includes('-') 
                                        ? "This is a recurring pre-authorized payment. Would you like to delete only this specific instance, or the entire recurring series?"
                                        : "Are you sure you want to delete this pre-authorized payment? This action cannot be undone."
                                    }
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end mt-4">
                                <Button variant="outline" onClick={() => setDeletingItem(null)}>
                                    Cancel
                                </Button>
                                {deletingItem.id.includes('-') ? (
                                    <>
                                        <Button variant="outline" onClick={handleDeleteInstance}>
                                            This Instance Only
                                        </Button>
                                        <Button variant="destructive" onClick={handleDeletePattern}>
                                            Entire Series
                                        </Button>
                                    </>
                                ) : (
                                    <Button variant="destructive" onClick={handleDeleteOneTime}>
                                        Delete
                                    </Button>
                                )}
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    )
}

export function PaPaymentsTable({ month, onMutation }: { month: string, onMutation?: () => void }) {
  const { budgetItems, addBudgetItem, updateBudgetItem, deleteBudgetItem, toggleBudgetItemCompleted, cycleBudgetItems, isLoading } = useBudget(month, onMutation);
  const { categories: budgetCategories } = useMonthlyBudget();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);

  const currentMonthLabel = format(parse(month + '-01', 'yyyy-MM-dd', new Date()), 'MMMM');
  const nextMonthLabel = format(addMonths(parse(month + '-01', 'yyyy-MM-dd', new Date()), 1), 'MMMM');

  const { currentMonthItems, nextMonthItems } = useMemo(() => {
    const allPaPayments = budgetItems.filter(item => item.type === 'Pre-Authorized Payments');
    return {
      currentMonthItems: allPaPayments.filter(item => !item.forNextMonth),
      nextMonthItems: allPaPayments.filter(item => item.forNextMonth),
    }
  }, [budgetItems]);

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
                <Button variant="outline" disabled={budgetItems.filter(item => item.type === 'Pre-Authorized Payments').length === 0}>
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
                  <AlertDialogAction onClick={() => cycleBudgetItems('Pre-Authorized Payments')} className={cn(buttonVariants({ variant: "default" }))}>
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
      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50 mb-6 no-print">
            <TabsTrigger value="current">{currentMonthLabel}</TabsTrigger>
            <TabsTrigger value="next">{nextMonthLabel}</TabsTrigger>
        </TabsList>
        <TabsContent value="current">
            <PaymentsTableContent
                items={currentMonthItems}
                isLoading={isLoading}
                onEdit={handleEdit}
                onDelete={deleteBudgetItem}
                onToggleCompleted={toggleBudgetItemCompleted}
                categoryMap={categoryMap}
            />
        </TabsContent>
        <TabsContent value="next">
             <PaymentsTableContent
                items={nextMonthItems}
                isLoading={isLoading}
                onEdit={handleEdit}
                onDelete={deleteBudgetItem}
                onToggleCompleted={toggleBudgetItemCompleted}
                categoryMap={categoryMap}
            />
        </TabsContent>
      </Tabs>
    </>
  );
}
