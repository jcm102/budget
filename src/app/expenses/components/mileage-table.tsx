

'use client';

import { useState } from 'react';
import { format, parse } from 'date-fns';
import { Pencil, Trash2, PlusCircle, Fuel, Wrench } from 'lucide-react';
import type { Expense, MileageLog, Honorarium, UploadableFile } from '@/types';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type MileageTableProps = {
  mileageLogs: MileageLog[];
  addExpense: (item: Omit<Expense, 'id'>, ledgerAccountId: string | undefined, receiptFile: UploadableFile | null | undefined, callback: (success: boolean) => void) => void;
  updateExpense: (id: string, item: Partial<Omit<Expense, 'id'>>) => void;
  addMileage: (item: Omit<MileageLog, 'id'>) => void;
  updateMileage: (id: string, item: Partial<Omit<MileageLog, 'id'>>) => void;
  deleteMileage: (id: string) => void;
  addHonorarium: (item: Omit<Honorarium, 'id'>) => void;
  updateHonorarium: (id: string, item: Partial<Omit<Honorarium, 'id'>>) => void;
  isLoading: boolean;
  isArchived: boolean;
};

const parseDate = (dateString: string) => {
    if (!dateString) return new Date();
    const datePart = dateString.split('T')[0];
    return parse(datePart, 'yyyy-MM-dd', new Date());
};

export function MileageTable({ 
  mileageLogs, 
  addExpense,
  updateExpense,
  addMileage,
  updateMileage,
  deleteMileage,
  addHonorarium,
  updateHonorarium,
  isLoading, 
  isArchived 
}: MileageTableProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MileageLog | Expense | Honorarium | null>(null);

  const handleEdit = (item: MileageLog) => {
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
    Array.from({ length: 4 }).map((_, i) => (
      <TableRow key={`skeleton-mileage-table-${i}`}>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
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

  const totalDistance = mileageLogs.reduce((acc, item) => acc + item.distance, 0);
  const totalReimbursement = mileageLogs
    .reduce((acc, item) => acc + (item.distance * item.rate), 0);
  
  const gasSplit = totalReimbursement * 0.6;
  const maintenanceSplit = totalReimbursement * 0.4;

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
            Add Mileage Log
          </Button>
        )}
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Origin</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Trip Type</TableHead>
              <TableHead>Distance</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Total</TableHead>
              {!isArchived && <TableHead className="w-[100px] text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              renderLoadingSkeletonTable()
            ) : mileageLogs.length > 0 ? (
              mileageLogs.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{format(parseDate(item.date), 'PPP')}</TableCell>
                  <TableCell className="font-medium">{item.description}</TableCell>
                  <TableCell>{item.origin}</TableCell>
                  <TableCell>{item.destination}</TableCell>
                  <TableCell><Badge variant="outline">{item.tripType || 'One-Way'}</Badge></TableCell>
                  <TableCell>{item.distance.toFixed(1)} km</TableCell>
                  <TableCell>{formatCurrency(item.rate)}</TableCell>
                  <TableCell>{formatCurrency(item.distance * item.rate)}</TableCell>
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
                                This will permanently delete this mileage log.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMileage(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
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
                  No mileage logged yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {mileageLogs.length > 0 && (
            <TableFooter>
                <TableRow>
                    <TableCell colSpan={5} className="font-semibold text-right">Totals</TableCell>
                    <TableCell className="font-semibold">{totalDistance.toFixed(1)} km</TableCell>
                    <TableCell colSpan={1}></TableCell>
                    <TableCell className="font-semibold text-right">{formatCurrency(totalReimbursement)}</TableCell>
                     {!isArchived && <TableCell colSpan={1}></TableCell>}
                </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
      
      {mileageLogs.length > 0 && (
        <Card className="mt-8">
            <CardHeader>
                <CardTitle>Mileage Reimbursement Allocation</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center gap-4 p-4 border rounded-lg">
                        <Fuel className="h-8 w-8 text-primary" />
                        <div>
                            <p className="text-muted-foreground">Gas (60%)</p>
                            <p className="text-xl font-semibold">{formatCurrency(gasSplit)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 p-4 border rounded-lg">
                        <Wrench className="h-8 w-8 text-primary" />
                        <div>
                            <p className="text-muted-foreground">Maintenance (40%)</p>
                            <p className="text-xl font-semibold">{formatCurrency(maintenanceSplit)}</p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
      )}
    </>
  );
}
