'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2, PlusCircle, MapPin } from 'lucide-react';
import type { MileageLog } from '@/types';
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
import { useMileage } from '@/hooks/use-mileage';
import { useExpenses } from '@/hooks/use-expenses';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from './ui/card';

export function MileageTable() {
  const { mileageLogs, addMileage, updateMileage, deleteMileage, isLoading } = useMileage();
  const { addExpense, updateExpense } = useExpenses(); // We need this for the form
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MileageLog | null>(null);

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

  const renderLoadingSkeleton = () => (
    Array.from({ length: 4 }).map((_, i) => (
       <Card key={`skeleton-mileage-${i}`} className="md:hidden">
        <CardContent className="p-4 space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/4" />
        </CardContent>
      </Card>
    ))
  );

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
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const totalDistance = mileageLogs.reduce((acc, item) => acc + item.distance, 0);
  const totalReimbursement = mileageLogs
    .filter(item => item.reimbursable)
    .reduce((acc, item) => acc + (item.distance * item.rate), 0);

  return (
    <>
      <ExpenseForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addExpense={addExpense}
        updateExpense={updateExpense}
        addMileage={addMileage}
        updateMileage={updateMileage}
        editingItem={editingItem}
      />
      <div className="flex justify-between items-center mb-6 gap-2">
        <h2 className="text-3xl font-bold font-headline text-primary">Mileage Log</h2>
        <Button onClick={() => setIsFormOpen(true)}>
          <PlusCircle className="mr-2 h-5 w-5" />
          Add Mileage Log
        </Button>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="p-4 border rounded-lg bg-card">
            <h4 className="text-muted-foreground">Total Distance</h4>
            <p className="text-2xl font-semibold">{totalDistance.toFixed(1)} km</p>
        </div>
        <div className="p-4 border rounded-lg bg-card">
            <h4 className="text-muted-foreground">Total Reimbursable</h4>
            <p className="text-2xl font-semibold">{formatCurrency(totalReimbursement)}</p>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {isLoading ? (
          renderLoadingSkeleton()
        ) : mileageLogs.length > 0 ? (
          mileageLogs.map((item) => (
            <Card key={item.id}>
                 <CardHeader className="p-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-lg">{item.description}</CardTitle>
                             <p className="text-sm text-muted-foreground">{format(new Date(item.date), 'PPP')}</p>
                        </div>
                        <div className="text-lg font-bold text-right">{formatCurrency(item.distance * item.rate)}</div>
                    </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 text-sm text-muted-foreground space-y-2">
                    <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 text-primary" />
                        <div>
                            <p><strong>From:</strong> {item.origin}</p>
                            <p><strong>To:</strong> {item.destination}</p>
                        </div>
                    </div>
                    <p><strong>Distance:</strong> {item.distance.toFixed(1)} km @ {formatCurrency(item.rate)}/km</p>
                    <div className="mt-2">
                        {item.reimbursable ? (
                          <Badge variant="default">Reimbursable</Badge>
                        ) : (
                          <Badge variant="secondary">Non-Reimbursable</Badge>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="p-4 pt-0 flex justify-end gap-2">
                     <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </Button>
                      <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="hover:text-destructive">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
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
                 </CardFooter>
            </Card>
          ))
        ) : (
          <p className="text-center text-muted-foreground py-8">No mileage logged yet.</p>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block rounded-lg border bg-card text-card-foreground shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Origin</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Distance</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[100px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              renderLoadingSkeletonTable()
            ) : mileageLogs.length > 0 ? (
              mileageLogs.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{format(new Date(item.date), 'PPP')}</TableCell>
                  <TableCell className="font-medium">{item.description}</TableCell>
                  <TableCell>{item.origin}</TableCell>
                  <TableCell>{item.destination}</TableCell>
                  <TableCell>{item.distance.toFixed(1)} km</TableCell>
                  <TableCell>{formatCurrency(item.rate)}</TableCell>
                  <TableCell>{formatCurrency(item.distance * item.rate)}</TableCell>
                   <TableCell>
                    {item.reimbursable ? (
                      <Badge variant="default">Reimbursable</Badge>
                    ) : (
                      <Badge variant="secondary">Non-Reimbursable</Badge>
                    )}
                  </TableCell>
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
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  No mileage logged yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={4} className="font-semibold text-right">Totals</TableCell>
              <TableCell className="font-semibold">{totalDistance.toFixed(1)} km</TableCell>
              <TableCell colSpan={1}></TableCell>
              <TableCell className="font-semibold">{formatCurrency(totalReimbursement)}</TableCell>
              <TableCell colSpan={2}></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  );
}
