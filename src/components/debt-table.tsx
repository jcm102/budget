'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2, PlusCircle, RotateCcw, GripVertical } from 'lucide-react';
import type { Debt } from '@/types';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
import { DebtForm } from './debt-form';
import { useDebt } from '@/hooks/use-debt';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';

type SortableDebtRowProps = {
  debt: Debt;
  onEdit: (debt: Debt) => void;
  onDelete: (id: string) => void;
  formatCurrency: (amount: number) => string;
};

function SortableDebtRow({ debt, onEdit, onDelete, formatCurrency }: SortableDebtRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: debt.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes}>
        <TableCell className="w-[24px] p-0 pr-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 cursor-grab" {...listeners}>
                <GripVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
        </TableCell>
        <TableCell className="font-medium">{debt.name}</TableCell>
        <TableCell className="text-right">{formatCurrency(debt.balance)}</TableCell>
        <TableCell className="text-right">{formatCurrency(debt.minimumPayment)}</TableCell>
        <TableCell className="text-right">{formatCurrency(debt.actualPayment)}</TableCell>
        <TableCell>{format(new Date(debt.dueDate), 'PPP')}</TableCell>
        <TableCell className="text-right">
        <div className="flex justify-end gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(debt)}>
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
                    This action cannot be undone. This will permanently delete this debt entry.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(debt.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
                    Delete
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
            </AlertDialog>
        </div>
        </TableCell>
    </TableRow>
  );
}


export function DebtTable() {
  const { debts, addDebt, updateDebt, deleteDebt, resetDebtValues, updateDebtOrder, isLoading } = useDebt();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleEdit = (debt: Debt) => {
    setEditingDebt(debt);
    setIsFormOpen(true);
  };

  const handleFormOpenChange = (isOpen: boolean) => {
    setIsFormOpen(isOpen);
    if (!isOpen) {
      setEditingDebt(null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = sortedDebts.findIndex((debt) => debt.id === active.id);
      const newIndex = sortedDebts.findIndex((debt) => debt.id === over!.id);
      const reorderedDebts = arrayMove(sortedDebts, oldIndex, newIndex);
      updateDebtOrder(reorderedDebts);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const renderLoadingSkeleton = () => (
    Array.from({ length: 3 }).map((_, i) => (
      <TableRow key={`skeleton-${i}`}>
        <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const totalBalance = debts.reduce((acc, debt) => acc + debt.balance, 0);
  const totalMinimumPayment = debts.reduce((acc, debt) => acc + debt.minimumPayment, 0);
  const totalActualPayment = debts.reduce((acc, debt) => acc + debt.actualPayment, 0);

  const sortedDebts = [...debts].sort((a,b) => a.order - b.order);

  return (
    <>
      <DebtForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addDebt={addDebt}
        updateDebt={updateDebt}
        editingDebt={editingDebt}
      />
      <div className="flex justify-between items-center mb-6 gap-2">
        <h2 className="text-3xl font-bold font-headline text-primary">Debt Payment Worksheet</h2>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={debts.length === 0}>
                <RotateCcw className="mr-2 h-5 w-5" />
                Reset All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action will reset the balance, payments, and due date for ALL debts. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={resetDebtValues} className={cn(buttonVariants({ variant: "destructive" }))}>
                  Yes, Reset All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Debt
          </Button>
        </div>
      </div>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[24px] p-0"></TableHead>
                <TableHead>Debt Name</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Minimum Payment</TableHead>
                <TableHead className="text-right">Actual Payment</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                <SortableContext items={sortedDebts.map(d => d.id)} strategy={verticalListSortingStrategy}>
                    {isLoading ? (
                      renderLoadingSkeleton()
                    ) : sortedDebts.length > 0 ? (
                      sortedDebts.map((debt) => (
                        <SortableDebtRow 
                            key={debt.id} 
                            debt={debt} 
                            onEdit={handleEdit} 
                            onDelete={deleteDebt}
                            formatCurrency={formatCurrency}
                        />
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center">
                          No debts entered yet. Add one to get started!
                        </TableCell>
                      </TableRow>
                    )}
                </SortableContext>
            </TableBody>
             <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">Totals</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totalBalance)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totalMinimumPayment)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totalActualPayment)}</TableCell>
                <TableCell colSpan={2}></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </DndContext>
      </div>
    </>
  );
}
