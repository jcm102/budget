
'use client';

import { useState, useMemo } from 'react';
import { Pencil, Trash2, PlusCircle, ArrowUpDown } from 'lucide-react';
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

type SortableHeaderProps = {
  column: keyof SubscriptionItem | 'monthlyCost';
  label: string;
  sortConfig: { key: keyof SubscriptionItem | 'monthlyCost'; direction: 'ascending' | 'descending' } | null;
  requestSort: (key: keyof SubscriptionItem | 'monthlyCost') => void;
  className?: string;
}

const SortableHeader = ({ column, label, sortConfig, requestSort, className }: SortableHeaderProps) => {
  const isSorted = sortConfig?.key === column;
  const direction = isSorted ? sortConfig.direction : 'ascending';
  return (
    <TableHead className={className}>
      <Button variant="ghost" onClick={() => requestSort(column)}>
        {label}
        {isSorted && <ArrowUpDown className={`ml-2 h-4 w-4 transform ${direction === 'descending' ? 'rotate-180' : ''}`} />}
        {!isSorted && <ArrowUpDown className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-50" />}
      </Button>
    </TableHead>
  )
}

export function SubscriptionTable() {
  const { subscriptions, addSubscription, updateSubscription, deleteSubscription, isLoading } = useSubscriptions();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SubscriptionItem | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof SubscriptionItem | 'monthlyCost'; direction: 'ascending' | 'descending' }>({ key: 'serviceName', direction: 'ascending' });


  const requestSort = (key: keyof SubscriptionItem | 'monthlyCost') => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getMonthlyCost = (item: SubscriptionItem) => {
    switch (item.billingFrequency) {
        case 'Annually':
            return item.cost / 12;
        case 'Quarterly':
            return item.cost / 3;
        case 'Monthly':
        default:
            return item.cost;
    }
  }

  const sortedItems = useMemo(() => {
    let sortableItems = [...subscriptions];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;

        if (sortConfig.key === 'monthlyCost') {
            aValue = getMonthlyCost(a);
            bValue = getMonthlyCost(b);
        } else {
            aValue = a[sortConfig.key as keyof SubscriptionItem];
            bValue = b[sortConfig.key as keyof SubscriptionItem];
        }

        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [subscriptions, sortConfig]);


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
    return acc + getMonthlyCost(item);
  }, 0);
  
  const totalAnnualCost = subscriptions.reduce((acc, item) => {
    const monthlyCost = getMonthlyCost(item);
    return acc + (monthlyCost * 12);
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
              <TableRow className="group">
                <SortableHeader column="serviceName" label="Service" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader column="billingFrequency" label="Billing Frequency" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader column="cost" label="Cost" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                <SortableHeader column="monthlyCost" label="Monthly Cost" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : sortedItems.length > 0 ? (
                    sortedItems.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.serviceName}</TableCell>
                            <TableCell><Badge variant="secondary">{item.billingFrequency}</Badge></TableCell>
                            <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(getMonthlyCost(item))}</TableCell>
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
                    <TableCell colSpan={5} className="h-24 text-center">
                        No subscriptions entered yet. Add one to get started!
                    </TableCell>
                    </TableRow>
                )}
            </TableBody>
            {subscriptions.length > 0 && (
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={3} className="font-semibold text-right">Total Monthly Cost</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(totalMonthlyCost)}</TableCell>
                        <TableCell></TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell colSpan={3} className="font-semibold text-right">Total Annual Cost</TableCell>
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
