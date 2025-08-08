
'use client';

import { useState } from 'react';
import { format, addMonths, differenceInYears } from 'date-fns';
import { Pencil, Trash2, PlusCircle, Check, ShoppingCart, View, Users } from 'lucide-react';
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
    [key in keyof SavingsItem | 'budgetedCost' | 'monthlyCost' | 'monthsRemaining' | 'budgetedThisMonth' | 'actions']?: boolean;
};

export function SavingsTable() {
  const { savingsItems, addSavingsItem, updateSavingsItem, deleteSavingsItem, processMonthlySavings, recordPurchase, isLoading } = useSavings();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SavingsItem | null>(null);
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
    budgetedThisMonth: false,
    totalBudgeted: true,
    actions: true,
  });

  const columnConfig = {
    expense: { label: 'Expense' },
    purchaseFrequency: { label: 'Frequency' },
    cost: { label: 'Prior Cost', isNumeric: true },
    isSplit: { label: 'Split?'},
    annualIncrease: { label: 'Ann. Increase %', isNumeric: true },
    budgetedCost: { label: 'Budgeted Cost', isNumeric: true },
    monthlyCost: { label: 'Monthly Cost', isNumeric: true },
    renewalDate: { label: 'Renewal Date' },
    monthsRemaining: { label: 'Months Rem.' },
    budgetedThisMonth: { label: 'Budgeted This Month', isNumeric: true },
    totalBudgeted: { label: 'Total Budgeted', isNumeric: true },
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
      const originalRenewalDate = new Date(item.renewalDate);
      const now = new Date(referenceDate);

      const costBasis = item.isSplit ? item.cost / 2 : item.cost;
      
      const yearsMap = {
        'Semi-Annually': 0.5, 'Annually': 1, 'Every 2 Years': 2, 'Every 3 Years': 3, 'Every 4 Years': 4, 'Every 5 Years': 5
      };
      const purchaseIntervalYears = yearsMap[item.purchaseFrequency];
      const purchaseIntervalMonths = purchaseIntervalYears * 12;

      let nextRenewalDate = new Date(originalRenewalDate);
      while (nextRenewalDate < now) {
          nextRenewalDate = addMonths(nextRenewalDate, purchaseIntervalMonths);
      }
      
      // Calculate how many cycles have passed to apply the increase correctly
      const yearsSinceFirstRenewal = differenceInYears(nextRenewalDate, originalRenewalDate);
      const numberOfIncreases = Math.floor(yearsSinceFirstRenewal / purchaseIntervalYears);

      let budgetedCost = costBasis;
      if (item.annualIncrease > 0) {
        // Use compound interest formula for a more accurate increase over time
        budgetedCost = costBasis * Math.pow(1 + item.annualIncrease / 100, numberOfIncreases);
      }
      
      const monthDiff = (nextRenewalDate.getFullYear() - now.getFullYear()) * 12 + (nextRenewalDate.getMonth() - now.getMonth());
      const monthsRemaining = Math.max(0, monthDiff);

      const monthlyCost = monthsRemaining > 0 ? (budgetedCost - item.totalBudgeted) / monthsRemaining : 0;
      
      const budgetedThisMonth = item.totalBudgeted + monthlyCost;

      return { budgetedCost, monthlyCost, monthsRemaining, budgetedThisMonth, nextRenewalDate };
  }

  const calculateProjectedCosts = (items: SavingsItem[]) => {
    const projections = [];
    const baseDate = new Date();

    for (let i = 0; i < 3; i++) {
        const projectionDate = addMonths(baseDate, i);
        let totalCost = 0;
        
        items.forEach(item => {
            let runningTotalBudgeted = item.totalBudgeted;
            for(let j = 0; j < i; j++) {
                const pastProjectionDate = addMonths(baseDate, j);
                const { monthlyCost: pastMonthlyCost } = calculateValues(
                    {...item, totalBudgeted: runningTotalBudgeted}, 
                    pastProjectionDate
                );
                runningTotalBudgeted += pastMonthlyCost;
            }
            const { monthlyCost } = calculateValues(
                {...item, totalBudgeted: runningTotalBudgeted },
                projectionDate
            );
            totalCost += monthlyCost;
        });

        projections.push({
            month: format(projectionDate, 'MMMM'),
            cost: totalCost,
        });
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
      <div className="flex justify-between items-center mb-6 gap-2">
        <h2 className="text-3xl font-bold font-headline text-primary">Future Spending Savings</h2>
        <div className="flex gap-2">
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
      </div>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                {Object.entries(columnConfig).map(([key, { label, isNumeric, isAction }]) => (
                  columnVisibility[key as keyof ColumnVisibility] && (
                     <TableHead key={key} className={cn(isNumeric && "text-right", isAction && "w-[140px] text-right")}>{label}</TableHead>
                  )
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : savingsItems.length > 0 ? (
                    savingsItems.map((item) => {
                        const { budgetedCost, monthlyCost, monthsRemaining, budgetedThisMonth, nextRenewalDate } = calculateValues(item);
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
                                {columnVisibility.budgetedThisMonth && <TableCell className="text-right">{formatCurrency(budgetedThisMonth)}</TableCell>}
                                {columnVisibility.totalBudgeted && <TableCell className="text-right">{formatCurrency(item.totalBudgeted)}</TableCell>}
                                {columnVisibility.actions && <TableCell className="text-right">
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
            {savingsItems.length > 0 && (
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
