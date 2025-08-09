
'use client';

import { useState } from 'react';
import { Pencil, Trash2, PlusCircle } from 'lucide-react';
import type { SubscriptionItem } from '@/types';

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
import { SubscriptionForm } from './subscription-form';
import { useSubscriptions } from '@/hooks/use-subscriptions';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';
import { Badge } from './ui/badge';

export function SubscriptionTable() {
  const { subscriptions, addSubscription, updateSubscription, deleteSubscription, isLoading } = useSubscriptions();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SubscriptionItem | null>(null);

  const handleEdit = (item: SubscriptionItem) => {
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
      <TableRow key={`skeleton-subscription-${i}`}>
        <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const totalMonthlyCost = subscriptions.reduce((acc, item) => {
    const monthlyCost = item.billingFrequency === 'Annually' ? item.cost / 12 : item.cost;
    return acc + monthlyCost;
  }, 0);
  
  const totalAnnualCost = subscriptions.reduce((acc, item) => {
    const annualCost = item.billingFrequency === 'Monthly' ? item.cost * 12 : item.cost;
    return acc + annualCost;
  }, 0);

  return (
    <>
      <SubscriptionForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addSubscription={addSubscription}
        updateSubscription={updateSubscription}
        editingItem={editingItem}
      />
      <div className="flex justify-end items-center mb-6 gap-2">
          <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Subscription
          </Button>
      </div>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Billing Frequency</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : subscriptions.length > 0 ? (
                    subscriptions.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.serviceName}</TableCell>
                            <TableCell><Badge variant="secondary">{item.billingFrequency}</Badge></TableCell>
                            <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
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
                                            This action cannot be undone. This will permanently delete this subscription.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteSubscription(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
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
                    <TableCell colSpan={4} className="h-24 text-center">
                        No subscriptions entered yet. Add one to get started!
                    </TableCell>
                    </TableRow>
                )}
            </TableBody>
            {subscriptions.length > 0 && (
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={2} className="font-semibold text-right">Total Monthly Cost</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(totalMonthlyCost)}</TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell colSpan={2} className="font-semibold text-right">Total Annual Cost</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(totalAnnualCost)}</TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                </TableFooter>
            )}
          </Table>
      </div>
    </>
  );
}
