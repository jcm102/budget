

'use client';

import { useState } from 'react';
import { format, parse } from 'date-fns';
import { Pencil, Trash2, PlusCircle } from 'lucide-react';
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
import { ExpenseForm } from './expense-form';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

type HonorariumTableProps = {
  honorariums: Honorarium[];
  addExpense: (item: Omit<Expense, 'id'>, ledgerAccountId: string | undefined, callback: (success: boolean) => void) => void;
  updateExpense: (id: string, item: Partial<Omit<Expense, 'id'>>) => void;
  addMileage: (item: Omit<MileageLog, 'id'>) => void;
  updateMileage: (id: string, item: Omit<MileageLog, 'id'>) => void;
  addHonorarium: (item: Omit<Honorarium, 'id'>) => void;
  updateHonorarium: (id: string, item: Partial<Omit<Honorarium, 'id'>>) => void;
  deleteHonorarium: (id: string) => void;
  isLoading: boolean;
  isArchived: boolean;
};

const parseDate = (dateString: string) => {
    return parse(dateString.split('T')[0], 'yyyy-MM-dd', new Date());
};

export function HonorariumTable({ 
  honorariums, 
  addExpense,
  updateExpense,
  addMileage,
  updateMileage,
  addHonorarium,
  updateHonorarium,
  deleteHonorarium,
  isLoading, 
  isArchived 
}: HonorariumTableProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Honorarium | null>(null);

  const handleEdit = (item: Honorarium) => {
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
    Array.from({ length: 2 }).map((_, i) => (
      <TableRow key={`skeleton-honorarium-${i}`}>
        <TableCell colSpan={4}><Skeleton className="h-6 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const totalHonorariums = honorariums.reduce((acc, item) => acc + item.amount, 0);

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
      <div className="flex justify-end items-center mb-6 gap-2">
        {!isArchived && (
          <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Honorarium
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              {!isArchived && <TableHead className="w-[100px] text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              renderLoadingSkeletonTable()
            ) : honorariums.length > 0 ? (
              honorariums.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{format(parseDate(item.date), 'PPP')}</TableCell>
                  <TableCell className="font-medium">{item.description}</TableCell>
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
                                This will permanently delete this honorarium item.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteHonorarium(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
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
                <TableCell colSpan={isArchived ? 3 : 4} className="h-24 text-center">
                  No honorariums logged yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {honorariums.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={isArchived ? 2 : 3} className="font-semibold text-right">Total Received</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totalHonorariums)}</TableCell>
                {!isArchived && <TableCell></TableCell>}
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </>
  );
}
