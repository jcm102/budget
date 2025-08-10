
'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2, PlusCircle, Repeat, Info, ChevronsUpDown, ArrowUpDown } from 'lucide-react';
import type { BudgetItem, BudgetItemType } from '@/types';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';

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

export function BudgetTable() {
  const { budgetItems, addBudgetItem, updateBudgetItem, deleteBudgetItem, toggleBudgetItemCompleted, isLoading } = useBudget();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'ascending' });

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
    let sortableItems = [...budgetItems];
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
  }, [budgetItems, sortConfig]);

  const renderLoadingSkeleton = () => (
    Array.from({ length: 3 }).map((_, i) => (
      <TableRow key={`skeleton-${i}`}>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const renderSection = (title: string, type: BudgetItemType) => {
    const items = sortedItems.filter(item => item.type === type);
    const total = items.reduce((acc, item) => acc + item.amount, 0);
    const showCompletedCheckbox = type === 'Pre-Authorized Payments' || type === 'Transfers';

    const remainingTotal = showCompletedCheckbox 
      ? items.filter(item => !item.completed).reduce((acc, item) => acc + item.amount, 0)
      : total;

    let columns = 5; // Default columns
    if (type === 'Income') columns = 6;
    if (type === 'Transfers') columns = 7;
    if (type === 'Pre-Authorized Payments') columns = 7;
    

    return (
      <Collapsible defaultOpen={true} className="mb-4">
        <div className="flex items-center gap-2 mb-4">
            <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 pl-0 hover:bg-transparent">
                    <ChevronsUpDown className="h-5 w-5 text-muted-foreground" />
                    <h3 className="text-2xl font-bold font-headline text-primary">{title}</h3>
                </Button>
            </CollapsibleTrigger>
          {type === 'Pre-Authorized Payments' && (
             <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground">
                  <Info className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                  <p className="text-sm">
                    Items that will come out of the Libro chequing account this month
                  </p>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <CollapsibleContent>
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <Table>
                <TableHeader>
                <TableRow className="group">
                    {showCompletedCheckbox && <TableHead className="w-[50px]">Paid</TableHead>}
                    <SortableHeader column="description" label="Description" sortConfig={sortConfig} requestSort={requestSort} />
                    {type === 'Income' && <TableHead>Category</TableHead>}
                    {type === 'Transfers' && <TableHead>From</TableHead>}
                    {type === 'Transfers' && <TableHead>To</TableHead>}
                    <SortableHeader column="date" label="Date" sortConfig={sortConfig} requestSort={requestSort} />
                    <TableHead>Frequency</TableHead>
                    <SortableHeader column="amount" label="Amount" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : items.length > 0 ? (
                    items.map((item) => (
                    <TableRow key={item.id} data-state={item.completed ? "completed" : "" } className={cn(item.completed && "bg-accent/30 text-muted-foreground")}>
                        {showCompletedCheckbox && (
                        <TableCell>
                            <Checkbox
                            checked={item.completed}
                            onCheckedChange={() => toggleBudgetItemCompleted(item.id, item.completed || false)}
                            aria-label={`Mark ${item.description} as paid`}
                            />
                        </TableCell>
                        )}
                        <TableCell className={cn("font-medium", item.completed && "line-through")}>{item.description}</TableCell>
                        {type === 'Income' && <TableCell>{item.category}</TableCell>}
                        {type === 'Transfers' && <TableCell>{item.transferFrom}</TableCell>}
                        {type === 'Transfers' && <TableCell>{item.transferTo}</TableCell>}
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
                                    This will permanently delete this budget item. For recurring items, this will delete all future occurrences.
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
                    <TableCell colSpan={columns} className="h-24 text-center">
                        No items added yet.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
                <TableFooter>
                    {showCompletedCheckbox ? (
                        <>
                            <TableRow>
                                <TableCell colSpan={columns - 3} />
                                <TableCell className="font-semibold text-right">Remaining</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(remainingTotal)}</TableCell>
                                <TableCell />
                            </TableRow>
                            <TableRow>
                                <TableCell colSpan={columns - 3} />
                                <TableCell className="font-semibold text-right">Total</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(total)}</TableCell>
                                <TableCell />
                            </TableRow>
                        </>
                    ) : (
                        <TableRow>
                            <TableCell colSpan={columns - 2}></TableCell>
                            <TableCell className="font-semibold text-right">Total</TableCell>
                            <TableCell className="text-right font-semibold">{formatCurrency(total)}</TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    )}
                </TableFooter>
            </Table>
            </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };
  
  const totalIncome = budgetItems.filter(i => i.type === 'Income').reduce((acc, i) => acc + i.amount, 0);
  const totalDebtPayments = budgetItems.filter(i => i.type === 'Debt Payments').reduce((acc, i) => acc + i.amount, 0);

  const remainingPAPayments = budgetItems
    .filter(i => i.type === 'Pre-Authorized Payments' && !i.completed)
    .reduce((acc, i) => acc + i.amount, 0);

  return (
    <>
      <BudgetForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addBudgetItem={addBudgetItem}
        updateBudgetItem={updateBudgetItem}
        editingItem={editingItem}
      />
      <div className="flex justify-between items-center mb-6 gap-2">
        <h2 className="text-3xl font-bold font-headline text-primary">Budget Overview</h2>
        <Button onClick={() => setIsFormOpen(true)}>
          <PlusCircle className="mr-2 h-5 w-5" />
          Add Budget Item
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="p-4 border rounded-lg bg-card">
            <h4 className="text-muted-foreground">Total Income</h4>
            <p className="text-2xl font-semibold">{formatCurrency(totalIncome)}</p>
        </div>
        <div className="p-4 border rounded-lg bg-card">
            <h4 className="text-muted-foreground">Total Debt Payments</h4>
            <p className="text-2xl font-semibold">{formatCurrency(totalDebtPayments)}</p>
        </div>
        <div className="p-4 border rounded-lg bg-card">
            <h4 className="text-muted-foreground">Remaining PA Payments</h4>
            <p className="text-2xl font-semibold">{formatCurrency(remainingPAPayments)}</p>
        </div>
      </div>

      {renderSection("Income", "Income")}
      {renderSection("Debt Payments", "Debt Payments")}
      {renderSection("Pre-Authorized Payments", "Pre-Authorized Payments")}
      {renderSection("Transfers", "Transfers")}
    </>
  );
}
