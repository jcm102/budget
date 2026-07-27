'use client';

import { useState, useMemo } from 'react';
import { format, parse, addMonths } from 'date-fns';
import { Pencil, Trash2, Repeat, Info, ArrowUpDown } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
        {isSorted && <ArrowUpDown className={cn("ml-2 h-4 w-4 transform", direction === 'descending' && "rotate-180")} />}
        {!isSorted && <ArrowUpDown className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-50" />}
      </Button>
    </TableHead>
  )
};

type PaymentsTableContentProps = {
    items: BudgetItem[];
    isLoading: boolean;
    onEdit: (item: BudgetItem) => void;
    onDelete: (id: string) => void;
    onToggleCompleted: (id: string, completed: boolean) => void;
};

function PaymentsTableContent({ items, isLoading, onEdit, onDelete, onToggleCompleted }: PaymentsTableContentProps) {
    const [sortConfig, setSortConfig] = useState<SortConfig>(null);

    const sortedItems = useMemo(() => {
        let sortableItems = [...items];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aVal = a[sortConfig.key];
                let bVal = b[sortConfig.key];

                if (sortConfig.key === 'date') {
                    aVal = parseDate(a.date).getTime();
                    bVal = parseDate(b.date).getTime();
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
                <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
            </TableRow>
        ))
    );

    const total = items.reduce((acc, item) => acc + item.amount, 0);
    const remainingTotal = items.filter(item => !item.completed).reduce((acc, item) => acc + item.amount, 0);

    return (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">Paid</TableHead>
                            <SortableHeader column="description" label="Description" sortConfig={sortConfig} requestSort={requestSort} />
                            <SortableHeader column="date" label="Date" sortConfig={sortConfig} requestSort={requestSort} />
                            <TableHead>Frequency</TableHead>
                            <SortableHeader column="amount" label="Amount" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                            <TableHead className="w-[150px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                    {isLoading ? (
                        renderLoadingSkeleton()
                    ) : sortedItems.length > 0 ? (
                        sortedItems.map((item) => (
                        <TableRow key={item.id} data-state={item.completed ? "completed" : "" } className={cn(item.completed && "bg-accent/30 text-muted-foreground", item.isVirtual && "border-l-4 border-l-amber-500 bg-amber-50/10")}>
                            <TableCell>
                                <Checkbox
                                checked={item.completed}
                                onCheckedChange={() => onToggleCompleted(item.id, item.completed || false)}
                                aria-label={`Mark ${item.description} as paid`}
                                />
                            </TableCell>
                            <TableCell className={cn("font-medium", item.completed && "line-through")}>
                                {item.description} {item.isVirtual && <span className="ml-1 text-[10px] text-amber-600 font-semibold">(Live Worksheet)</span>}
                            </TableCell>
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
                            {item.isVirtual ? (
                                <span className="text-xs text-muted-foreground italic pr-2">Managed in Worksheet</span>
                            ) : (
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
                            )}
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

export function DebtPaymentsTable({ month, onMutation }: { month: string, onMutation?: () => void }) {
  const { budgetItems, addBudgetItem, updateBudgetItem, deleteBudgetItem, toggleBudgetItemCompleted, isLoading } = useBudget(month, onMutation);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);

  const currentMonthLabel = format(parse(month + '-01', 'yyyy-MM-dd', new Date()), 'MMMM');
  const nextMonthLabel = format(addMonths(parse(month + '-01', 'yyyy-MM-dd', new Date()), 1), 'MMMM');

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
                   Worksheet debt payments are synced dynamically and automatically.
                </p>
            </PopoverContent>
            </Popover>
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
            />
        </TabsContent>
        <TabsContent value="next">
             <PaymentsTableContent
                items={nextMonthItems}
                isLoading={isLoading}
                onEdit={handleEdit}
                onDelete={deleteBudgetItem}
                onToggleCompleted={toggleBudgetItemCompleted}
            />
        </TabsContent>
      </Tabs>
    </>
  );
}
