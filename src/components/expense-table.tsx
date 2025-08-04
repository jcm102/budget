
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2, PlusCircle } from 'lucide-react';
import type { Expense } from '@/types';
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
import { Badge } from '@/components/ui/badge';
import { ExpenseForm } from './expense-form';
import { useExpenses } from '@/hooks/use-expenses';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';

export function ExpenseTable() {
  const { expenses, addExpense, updateExpense, deleteExpense, isLoading } = useExpenses();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Expense | null>(null);

  const handleEdit = (item: Expense) => {
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
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={`skeleton-${i}`}>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const totalExpenses = expenses.reduce((acc, item) => acc + item.amount, 0);
  const totalReimbursable = expenses
    .filter((item) => item.reimbursable)
    .reduce((acc, item) => acc + item.amount, 0);

  return (
    <>
      <ExpenseForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addExpense={addExpense}
        updateExpense={updateExpense}
        editingItem={editingItem}
      />
      <div className="flex justify-between items-center mb-6 gap-2">
        <h2 className="text-3xl font-bold font-headline text-primary">Work Expense Tracking</h2>
        <Button onClick={() => setIsFormOpen(true)}>
          <PlusCircle className="mr-2 h-5 w-5" />
          Add Work Expense
        </Button>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="p-4 border rounded-lg bg-card">
            <h4 className="text-muted-foreground">Total Expenses</h4>
            <p className="text-2xl font-semibold">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="p-4 border rounded-lg bg-card">
            <h4 className="text-muted-foreground">Total Reimbursable</h4>
            <p className="text-2xl font-semibold">{formatCurrency(totalReimbursable)}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Paid From</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              renderLoadingSkeleton()
            ) : expenses.length > 0 ? (
              expenses.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{format(new Date(item.date), 'PPP')}</TableCell>
                  <TableCell className="font-medium">{item.description}</TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.transferee}</TableCell>
                   <TableCell>
                    {item.reimbursable ? (
                      <Badge variant="default">Reimbursable</Badge>
                    ) : (
                      <Badge variant="secondary">Non-Reimbursable</Badge>
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
                              This will permanently delete this expense item.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteExpense(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
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
                  No expenses added yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={5} className="font-semibold text-right">Total Expenses</TableCell>
              <TableCell className="text-right font-semibold">{formatCurrency(totalExpenses)}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  );
}
