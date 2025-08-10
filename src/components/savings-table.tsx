
'use client';

import { useState, useMemo } from 'react';
import { format, addMonths, isBefore, getYear, getMonth, startOfDay, differenceInCalendarMonths } from 'date-fns';
import { Pencil, Trash2, PlusCircle, Check, ShoppingCart, View, Users, ArrowUpDown } from 'lucide-react';
import type { SavingsItem } from '@/types';

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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

type ColumnVisibility = {
    [key in keyof SavingsItem | 'budgetedCost' | 'monthlyCost' | 'monthsRemaining' | 'actions']?: boolean;
};

type SortConfig = {
    key: keyof SavingsItem | 'budgetedCost' | 'monthlyCost';
    direction: 'ascending' | 'descending';
} | null;

const yearsMap = {
  'Semi-Annually': 0.5, 'Annually': 1, 'Every 2 Years': 2, 'Every 3 Years': 3, 'Every 4 Years': 4, 'Every 5 Years': 5
};

function calculateNextRenewalDate(renewalDate: Date, frequency: keyof typeof yearsMap, now: Date): Date {
  const purchaseIntervalMonths = yearsMap[frequency] * 12;
  let nextRenewal = new Date(renewalDate);
  while (isBefore(nextRenewal, now)) {
      nextRenewal = addMonths(nextRenewal, purchaseIntervalMonths);
  }
  return nextRenewal;
}

const SortableHeader = ({ column, label, sortConfig, requestSort, className, isNumeric }: { column: SortConfig['key'], label: string, sortConfig: SortConfig, requestSort: (key: SortConfig['key']) => void, className?: string, isNumeric?: boolean }) => {
  const isSorted = sortConfig?.key === column;
  const direction = isSorted ? sortConfig.direction : 'ascending';
  return (
    <TableHead className={cn(className, isNumeric && 'text-right')}>
      <Button variant="ghost" onClick={() => requestSort(column)} className={cn(isNumeric && "w-full justify-end")}>
        {label}
        {isSorted && <ArrowUpDown className={`ml-2 h-4 w-4 transform ${direction === 'descending' ? 'rotate-180' : ''}`} />}
        {!isSorted && <ArrowUpDown className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-50" />}
      </Button>
    </TableHead>
  )
}


export function SavingsTable() {
  const { savingsItems, addSavingsItem, updateSavingsItem, deleteSavingsItem, processMonthlySavings, recordPurchase, isLoading } = useSavings();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SavingsItem | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'expense', direction: 'ascending' });
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    expense: true,
    purchaseFrequency: true,
    cost: true,
    isSplit: true,
    annualIncrease: true,
    budgetedCost: true,
    monthlyCost: true,
    renewalDate: true,
    monthsRemaining: false,
    totalBudgeted: true,
    actions: true,
  });

  const columnConfig = {
    expense: { label: 'Expense', sortable: true },
    purchaseFrequency: { label: 'Frequency' },
    cost: { label: 'Prior Cost', isNumeric: true },
    isSplit: { label: 'Split?'},
    annualIncrease: { label: 'Ann. Increase %', isNumeric: true },
    budgetedCost: { label: 'Budgeted Cost', isNumeric: true, sortable: true },
    monthlyCost: { label: 'Monthly Cost', isNumeric: true, sortable: true },
    renewalDate: { label: 'Renewal Date', sortable: true },
    monthsRemaining: { label: 'Months Rem.' },
    totalBudgeted: { label: 'Total Budgeted', isNumeric: true, sortable: true },
    actions: { label: 'Actions', isAction: true },
  };

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
  
  const calculateValues = (item: SavingsItem, referenceDate = new Date()) => {
    const costBasis = item.isSplit ? item.cost / 2 : item.cost;
    const budgetedCost = costBasis * (1 + item.annualIncrease / 100);

    const now = startOfDay(referenceDate);
    const renewalDate = startOfDay(new Date(item.renewalDate));
    const nextRenewalDate = calculateNextRenewalDate(renewalDate, item.purchaseFrequency, now);
    
    const currentYear = getYear(now);
    const currentMonth = getMonth(now);
    const renewalYear = getYear(nextRenewalDate);
    const renewalMonth = getMonth(nextRenewalDate);
    
    let monthsRemaining = (renewalYear - currentYear) * 12 + (renewalMonth - currentMonth);

    if (monthsRemaining <= 0) {
      monthsRemaining = 1;
    }
    
    const amountToSave = budgetedCost - item.totalBudgeted;
    const monthlyCost = amountToSave > 0 && monthsRemaining > 0 ? amountToSave / monthsRemaining : 0;
    
    return { budgetedCost, monthlyCost, monthsRemaining, nextRenewalDate };
  }

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
        let aValue, bValue;

        if (sortConfig.key === 'budgetedCost' || sortConfig.key === 'monthlyCost') {
            aValue = calculateValues(a)[sortConfig.key];
            bValue = calculateValues(b)[sortConfig.key];
        } else if (sortConfig.key === 'renewalDate') {
            aValue = calculateValues(a).nextRenewalDate.getTime();
            bValue = calculateValues(b).nextRenewalDate.getTime();
        } else {
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


  const calculateProjectedCosts = (items: SavingsItem[]) => {
    const projections = [];
    const baseDate = new Date();
    
    let simulatedItems = JSON.parse(JSON.stringify(items));

    for (let i = 0; i < 3; i++) {
        const projectionDate = addMonths(baseDate, i);
        let totalMonthCost = 0;

        const nextSimulatedItems = [];
        for (const item of simulatedItems) {
            const { monthlyCost, nextRenewalDate } = calculateValues(item, projectionDate);
            totalMonthCost += monthlyCost;

            const newItem = {...item};
            newItem.totalBudgeted += monthlyCost;

            const renewalDate = startOfDay(new Date(nextRenewalDate));
            const projDate = startOfDay(new Date(projectionDate));

            if (getYear(renewalDate) === getYear(projDate) && getMonth(renewalDate) === getMonth(projDate)) {
                 const { budgetedCost } = calculateValues(item, projectionDate);
                 newItem.totalBudgeted -= budgetedCost; 
                 newItem.renewalDate = addMonths(new Date(nextRenewalDate), (yearsMap[item.purchaseFrequency] * 12)).toISOString();
            }
            nextSimulatedItems.push(newItem);
        }

        projections.push({
            month: format(projectionDate, 'MMMM'),
            cost: totalMonthCost,
        });

        simulatedItems = nextSimulatedItems;
    }
    return projections;
  }
  
  const visibleColumns = Object.keys(columnVisibility).filter(key => columnVisibility[key as keyof ColumnVisibility]);
  const colSpan = visibleColumns.length;

  const renderLoadingSkeleton = () => (
    Array.from({ length: 3 }).map((_, i) => (
      <TableRow key={`skeleton-${i}`}>
        <TableCell colSpan={colSpan}><Skeleton className="h-8 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const totalMonthlyCost = savingsItems.reduce((acc, item) => acc + calculateValues(item).monthlyCost, 0);
  const grandTotalBudgeted = savingsItems.reduce((acc, item) => acc + item.totalBudgeted, 0);
  const projectedCosts = savingsItems.length > 0 ? calculateProjectedCosts(savingsItems) : [];

  return (
    <>
      <SavingsForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addSavingsItem={addSavingsItem}
        updateSavingsItem={updateSavingsItem}
        editingItem={editingItem}
      />
      <div className="flex justify-end items-center mb-6 gap-2 no-print">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={savingsItems.length === 0}>
                  <Check className="mr-2 h-5 w-5" />
                  Process Month
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Process Monthly Savings?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will calculate the monthly savings for each item and add it to the "Total Budgeted" amount. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={processMonthlySavings}>
                    Yes, Process Month
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <View className="mr-2 h-4 w-4" />
                  View
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(columnConfig).map(([key, { label }]) => (
                   <DropdownMenuCheckboxItem
                    key={key}
                    className="capitalize"
                    checked={columnVisibility[key as keyof ColumnVisibility]}
                    onCheckedChange={(value) =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        [key]: !!value,
                      }))
                    }
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Savings Item
          </Button>
      </div>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="group">
                {Object.entries(columnConfig).map(([key, { label, isNumeric, isAction, sortable }]) => (
                  columnVisibility[key as keyof ColumnVisibility] && (
                     sortable ? (
                         <SortableHeader key={key} column={key as SortConfig['key']} label={label} sortConfig={sortConfig} requestSort={requestSort} className={cn(isAction && "w-[140px]")} isNumeric={isNumeric} />
                     ) : (
                        <TableHead key={key} className={cn(isNumeric && "text-right", isAction && "w-[140px] text-right")}>{label}</TableHead>
                     )
                  )
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : sortedItems.length > 0 ? (
                    sortedItems.map((item) => {
                        const { budgetedCost, monthlyCost, monthsRemaining, nextRenewalDate } = calculateValues(item);
                        return (
                            <TableRow key={item.id}>
                                {columnVisibility.expense && <TableCell className="font-medium">{item.expense}</TableCell>}
                                {columnVisibility.purchaseFrequency && <TableCell><Badge variant="secondary">{item.purchaseFrequency}</Badge></TableCell>}
                                {columnVisibility.cost && <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>}
                                {columnVisibility.isSplit && <TableCell>
                                    {item.isSplit && <Badge variant="outline" className="flex items-center gap-1"><Users className="h-3 w-3"/>Split</Badge>}
                                </TableCell>}
                                {columnVisibility.annualIncrease && <TableCell className="text-right">{item.annualIncrease.toFixed(2)}%</TableCell>}
                                {columnVisibility.budgetedCost && <TableCell className="text-right">{formatCurrency(budgetedCost)}</TableCell>}
                                {columnVisibility.monthlyCost && <TableCell className="text-right">{formatCurrency(monthlyCost)}</TableCell>}
                                {columnVisibility.renewalDate && <TableCell>{format(nextRenewalDate, 'PPP')}</TableCell>}
                                {columnVisibility.monthsRemaining && <TableCell>{monthsRemaining}</TableCell>}
                                {columnVisibility.totalBudgeted && <TableCell className="text-right">{formatCurrency(item.totalBudgeted)}</TableCell>}
                                {columnVisibility.actions && <TableCell className="text-right no-print">
                                    <div className="flex justify-end gap-1">
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700">
                                                    <ShoppingCart className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                <AlertDialogTitle>Record Purchase?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    This will deduct {formatCurrency(budgetedCost)} from the budgeted total and advance the renewal date. This cannot be undone.
                                                </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => recordPurchase(item.id)} className={cn(buttonVariants({ variant: "default" }))}>
                                                    Confirm Purchase
                                                </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
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
                                                This action cannot be undone. This will permanently delete this savings item.
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => deleteSavingsItem(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
                                                Delete
                                            </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </TableCell>}
                            </TableRow>
                        )
                    })
                ) : (
                    <TableRow>
                    <TableCell colSpan={colSpan} className="h-24 text-center">
                        No savings items entered yet. Add one to get started!
                    </TableCell>
                    </TableRow>
                )}
            </TableBody>
            {sortedItems.length > 0 && (
            <TableFooter>
                <TableRow>
                    <TableCell colSpan={visibleColumns.indexOf('monthlyCost')} className="font-semibold text-right">Total Monthly Cost</TableCell>
                    {columnVisibility.monthlyCost && <TableCell className="text-right font-semibold">{formatCurrency(totalMonthlyCost)}</TableCell>}
                    
                    <TableCell colSpan={visibleColumns.indexOf('totalBudgeted') - visibleColumns.indexOf('monthlyCost') -1} className="font-semibold text-right">Grand Total Budgeted</TableCell>
                    {columnVisibility.totalBudgeted && <TableCell className="text-right font-semibold">{formatCurrency(grandTotalBudgeted)}</TableCell>}

                    {columnVisibility.actions && <TableCell></TableCell>}
                </TableRow>
            </TableFooter>
            )}
          </Table>
      </div>
       {projectedCosts.length > 0 && (
        <Card className="mt-8">
            <CardHeader>
                <CardTitle>Projected Monthly Savings</CardTitle>
            </CardHeader>
            <CardContent>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    {projectedCosts.map((p, index) => (
                        <div key={index} className="p-4 border rounded-lg bg-secondary/30">
                            <h4 className="text-lg font-semibold text-primary">{p.month}</h4>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(p.cost)}</p>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
      )}
    </>
  );
}
