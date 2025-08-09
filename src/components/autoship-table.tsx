
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2, PlusCircle, RotateCw } from 'lucide-react';
import type { AutoShipItem } from '@/types';

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
import { AutoShipForm } from './autoship-form';
import { useAutoShip } from '@/hooks/use-autoship';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';
import { Badge } from './ui/badge';
import { useToast } from '@/hooks/use-toast';

export function AutoShipTable() {
  const { autoShipItems, addAutoShipItem, updateAutoShipItem, deleteAutoShipItem, shipItem, isLoading } = useAutoShip();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AutoShipItem | null>(null);
  const { toast } = useToast();

  const handleEdit = (item: AutoShipItem) => {
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

  const handleShipItem = async (item: AutoShipItem) => {
    try {
        await shipItem(item.id);
        toast({
            title: 'Item Shipped!',
            description: `The next shipment date for "${item.item}" has been updated.`
        });
    } catch (error) {
        toast({
            title: 'Error',
            description: 'There was a problem updating the shipment date.',
            variant: 'destructive',
        })
    }
  }

  const renderLoadingSkeleton = () => (
    Array.from({ length: 3 }).map((_, i) => (
      <TableRow key={`skeleton-autoship-${i}`}>
        <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
      </TableRow>
    ))
  );

  return (
    <>
      <AutoShipForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addAutoShipItem={addAutoShipItem}
        updateAutoShipItem={updateAutoShipItem}
        editingItem={editingItem}
      />
      <div className="flex justify-end items-center mb-6 gap-2">
          <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Auto-Ship Item
          </Button>
      </div>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Next Shipment</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead className="text-right">Estimated Cost</TableHead>
                <TableHead className="w-[140px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : autoShipItems.length > 0 ? (
                    autoShipItems.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.item}</TableCell>
                            <TableCell>{format(new Date(item.nextShipmentDate), 'PPP')}</TableCell>
                            <TableCell><Badge variant="secondary">{item.frequency}</Badge></TableCell>
                            <TableCell className="text-right">{formatCurrency(item.estimatedCost)}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleShipItem(item)}>
                                        <RotateCw className="h-4 w-4" />
                                    </Button>
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
                                            This action cannot be undone. This will permanently delete this auto-ship item.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => deleteAutoShipItem(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
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
                        No auto-ship items entered yet. Add one to get started!
                    </TableCell>
                    </TableRow>
                )}
            </TableBody>
          </Table>
      </div>
    </>
  );
}
