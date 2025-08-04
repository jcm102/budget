'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2, PlusCircle, ArrowUpDown, Repeat } from 'lucide-react';
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

export function BudgetTable() {
  const { budgetItems, addBudgetItem, updateBudgetItem, deleteBudgetItem, isLoading } = useBudget();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);

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
    const items = budgetItems.filter(item => item.type === type);
    const total = items.reduce((acc, item) => acc + item.amount, 0);
    
    let colSpan = 5;
    if (type === 'Transfers') colSpan = 6;
    if (type === 'Income') colSpan = 6;

    return (
      <div className="mb-8">
        <h3 className="text-2xl font-bold font-headline text-primary mb-4">{title}</h3>
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                {type === 'Income' && <TableHead>Category</TableHead>}
                {type === 'Transfers' && <TableHead>From</TableHead>}
                {type === 'Transfers' && <TableHead>To</TableHead>}
                <TableHead>Date</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                renderLoadingSkeleton()
              ) : items.length > 0 ? (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.description}</TableCell>
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
                  <TableCell colSpan={colSpan} className="h-24 text-center">
                    No items added yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={colSpan - 2}></TableCell>
                <TableCell className="font-semibold text-right">Total</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(total)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    );
  };
  
  const totalIncome = budgetItems.filter(i => i.type === 'Income').reduce((acc, i) => acc + i.amount, 0);
  const totalDebtPayments = budgetItems.filter(i => i.type === 'Debt Payments').reduce((acc, i) => acc + i.amount, 0);
  const totalPAPayments = budgetItems.filter(i => i.type === 'Pre-Authorized Payments').reduce((acc, i) => acc + i.amount, 0);

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
            <h4 className="text-muted-foreground">Total Pre-Authorized Payments</h4>
            <p className="text-2xl font-semibold">{formatCurrency(totalPAPayments)}</p>
        </div>
      </div>

      {renderSection("Income", "Income")}
      {renderSection("Debt Payments", "Debt Payments")}
      {renderSection("Pre-Authorized Payments", "Pre-Authorized Payments")}
      {renderSection("Transfers", "Transfers")}
    </>
  );
}
