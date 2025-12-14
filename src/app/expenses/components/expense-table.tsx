
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { format, parse } from 'date-fns';
import { Pencil, Trash2, PlusCircle, Repeat, Paperclip } from 'lucide-react';
import type { Expense, MileageLog, Honorarium } from '@/types';
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

type ExpenseTableProps = {
  expenses: Expense[];
  addExpense: (item: Omit<Expense, 'id'>, ledgerAccountId: string | undefined, receiptFile: File | undefined, callback: (success: boolean) => void) => void;
  updateExpense: (id: string, item: Partial<Omit<Expense, 'id'>>) => void;
  deleteExpense: (id: string) => void;
  toggleExpenseCompleted: (id: string, completed: boolean) => void;
  addMileage: (item: Omit<MileageLog, 'id'>) => void;
  updateMileage: (id: string, item: Partial<Omit<MileageLog, 'id'>>) => void;
  addHonorarium: (item: Omit<Honorarium, 'id'>) => void;
  updateHonorarium: (id: string, item: Partial<Omit<Honorarium, 'id'>>) => void;
  isLoading: boolean;
  isArchived: boolean;
};

const parseDate = (dateString: string) => {
    return parse(dateString.split('T')[0], 'yyyy-MM-dd', new Date());
};

export function ExpenseTable({ 
  expenses, 
  addExpense,
  updateExpense,
  deleteExpense,
  toggleExpenseCompleted,
  addMileage,
  updateMileage,
  addHonorarium,
  updateHonorarium,
  isLoading, 
  isArchived 
}: ExpenseTableProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Expense | MileageLog | Honorarium | null>(null);

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
  
  const renderLoadingSkeletonTable = () => (
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={`skeleton-table-${i}`}>
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
  
  return (
    <>
      <ExpenseForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addExpense={addExpense}
        updateExpense={updateExpense}
        addMileage={addMileage}
        updateMileage={updateMileage}
        addHonorarium={addHonorarium}
        updateHonorarium={updateHonorarium}
        editingItem={editingItem}
      />
      {!isArchived && (
        <div className="flex justify-end items-center mb-6 gap-2">
            <Button onClick={() => {
                setEditingItem(null); // Explicitly set to null for new item
                setIsFormOpen(true);
            }}>
                <PlusCircle className="mr-2 h-5 w-5" />
                Add Monetary Expense
            </Button>
        </div>
      )}


      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">Paid</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Payment Source</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {!isArchived && <TableHead className="w-[100px] text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              renderLoadingSkeletonTable()
            ) : expenses.length > 0 ? (
              expenses.map((item) => (
                <TableRow key={item.id} data-state={item.completed ? "completed" : "" } className={cn(item.completed && "bg-accent/30 text-muted-foreground")}>
                   <TableCell>
                        <Checkbox
                          checked={item.completed}
                          onCheckedChange={() => toggleExpenseCompleted(item.id, item.completed || false)}
                          aria-label={`Mark ${item.description} as paid`}
                          disabled={isArchived}
                        />
                      </TableCell>
                  <TableCell>{format(parseDate(item.date), 'PPP')}</TableCell>
                  <TableCell className={cn("font-medium", item.completed && "line-through")}>
                    <div className="flex items-center gap-2">
                      <span>{item.description}</span>
                      {item.receiptUrl && (
                        <Link href={item.receiptUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                          <Paperclip className="h-4 w-4 text-muted-foreground hover:text-primary" />
                        </Link>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>{item.transferee}</TableCell>
                   <TableCell>
                      {item.frequency !== 'One-Time' ? (
                        <Badge variant="secondary" className="gap-1 items-center">
                          <Repeat className="h-3 w-3" /> {item.frequency}
                        </Badge>
                      ) : (
                        <Badge variant="outline">One-Time</Badge>
                      )}
                    </TableCell>
                   <TableCell>
                    {item.reimbursable ? (
                      <Badge variant="default">Reimbursable</Badge>
                    ) : (
                      <Badge variant="secondary">Non-Reimbursable</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                  {!isArchived && (
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
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={isArchived ? 8 : 9} className="h-24 text-center">
                  No expenses added yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {expenses.length > 0 && (
            <TableFooter>
                <TableRow>
                <TableCell colSpan={isArchived ? 7 : 8} className="font-semibold text-right">Total Expenses</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totalExpenses)}</TableCell>
                {!isArchived && <TableCell></TableCell>}
                </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </>
  );
}
