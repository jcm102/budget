
'use client';

import { useState } from 'react';
import { format, addMonths } from 'date-fns';
import { Pencil, Trash2, PlusCircle, Check, ShoppingCart } from 'lucide-react';
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

export function SavingsTable() {
  const { savingsItems, addSavingsItem, updateSavingsItem, deleteSavingsItem, processMonthlySavings, recordPurchase, isLoading } = useSavings();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SavingsItem | null>(null);

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
      const renewalDate = new Date(item.renewalDate);
      const now = new Date(referenceDate);
      
      let budgetedCost = item.cost;

      const yearsMap = {
        'Semi-Annually': 0.5, 'Annually': 1, 'Every 2 Years': 2, 'Every 3 Years': 3, 'Every 4 Years': 4, 'Every 5 Years': 5
      };
      const purchaseInterval = yearsMap[item.purchaseFrequency];
      const purchaseIntervalInMonths = purchaseInterval * 12;

      let nextRenewalDate = new Date(renewalDate);
       while(nextRenewalDate < now) {
          budgetedCost = budgetedCost * (1 + item.annualIncrease / 100);
          nextRenewalDate.setMonth(nextRenewalDate.getMonth() + purchaseIntervalInMonths);
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

  const renderLoadingSkeleton = () => (
    Array.from({ length: 3 }).map((_, i) => (
      <TableRow key={`skeleton-${i}`}>
        <TableCell colSpan={11}><Skeleton className="h-8 w-full" /></TableCell>
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
                <TableHead>Expense</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Ann. Increase %</TableHead>
                <TableHead className="text-right">Budgeted Cost</TableHead>
                <TableHead className="text-right">Monthly Cost</TableHead>
                <TableHead>Renewal Date</TableHead>
                <TableHead>Months Remaining</TableHead>
                <TableHead className="text-right">Budgeted This Month</TableHead>
                <TableHead className="text-right">Total Budgeted</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
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
                                <TableCell className="font-medium">{item.expense}</TableCell>
                                <TableCell><Badge variant="secondary">{item.purchaseFrequency}</Badge></TableCell>
                                <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
                                <TableCell className="text-right">{item.annualIncrease.toFixed(2)}%</TableCell>
                                <TableCell className="text-right">{formatCurrency(budgetedCost)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(monthlyCost)}</TableCell>
                                <TableCell>{format(nextRenewalDate, 'PPP')}</TableCell>
                                <TableCell>{monthsRemaining}</TableCell>
                                <TableCell className="text-right">{formatCurrency(budgetedThisMonth)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.totalBudgeted)}</TableCell>
                                <TableCell className="text-right">
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
                                </TableCell>
                            </TableRow>
                        )
                    })
                ) : (
                    <TableRow>
                    <TableCell colSpan={11} className="h-24 text-center">
                        No savings items entered yet. Add one to get started!
                    </TableCell>
                    </TableRow>
                )}
            </TableBody>
            {savingsItems.length > 0 && (
            <TableFooter>
                <TableRow>
                    <TableCell colSpan={5} className="font-semibold text-right">Total Monthly Cost</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(totalMonthlyCost)}</TableCell>
                    <TableCell colSpan={3} className="font-semibold text-right">Grand Total Budgeted</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(grandTotalBudgeted)}</TableCell>
                    <TableCell></TableCell>
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
