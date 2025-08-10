
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2, PlusCircle, GripVertical } from 'lucide-react';
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
import { Checkbox } from './ui/checkbox';


export type ColumnVisibility = {
    [key in keyof Debt | 'actions']?: boolean;
};

type DebtView = 'current' | 'next';

type SortableDebtRowProps = {
  debt: Debt;
  view: DebtView;
  onEdit: (debt: Debt) => void;
  onDelete: (id: string) => void;
  onTogglePaid: (id: string, view: DebtView) => void;
  formatCurrency: (amount: number) => string;
  columnVisibility: ColumnVisibility;
};

function SortableDebtRow({ debt, view, onEdit, onDelete, onTogglePaid, formatCurrency, columnVisibility }: SortableDebtRowProps) {
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

  const isCurrentView = view === 'current';
  const balance = isCurrentView ? debt.balance : debt.nextBalance;
  const minPayment = isCurrentView ? debt.minimumPayment : debt.nextMinimumPayment;
  const actualPayment = isCurrentView ? debt.actualPayment : undefined;
  const dueDate = isCurrentView ? debt.dueDate : debt.nextDueDate;
  const isPaid = isCurrentView ? debt.paid : debt.nextPaid;

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes} className={cn(isPaid && "bg-accent/30 text-muted-foreground")}>
        <TableCell className="w-[24px] p-0 pr-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 cursor-grab" {...listeners}>
                <GripVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
        </TableCell>
        {columnVisibility.paid && <TableCell>
            <Checkbox
              checked={isPaid}
              onCheckedChange={() => onTogglePaid(debt.id, view)}
              aria-label={`Mark ${debt.name} as paid`}
              className="mr-2"
            />
        </TableCell>}
        {columnVisibility.name && <TableCell className={cn("font-medium", isPaid && "line-through")}>{debt.name}</TableCell>}
        {columnVisibility.balance && <TableCell className="text-right">{formatCurrency(balance || 0)}</TableCell>}
        {columnVisibility.minimumPayment && <TableCell className="text-right">{formatCurrency(minPayment || 0)}</TableCell>}
        {columnVisibility.actualPayment && <TableCell className="text-right font-bold">{isCurrentView ? formatCurrency(actualPayment || 0) : '-'}</TableCell>}
        {columnVisibility.dueDate && <TableCell>{dueDate ? format(new Date(dueDate), 'PPP') : '-'}</TableCell>}
        {columnVisibility.actions && <TableCell className="text-right">
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
                    This action cannot be undone. This will permanently delete this debt entry and all its data for both current and next month.
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
        </TableCell>}
    </TableRow>
  );
}


type DebtTableProps = {
    view: DebtView;
    columnVisibility: ColumnVisibility;
    columnConfig: Record<string, { label: string; isNumeric?: boolean; isAction?: boolean }>;
};

export function DebtTable({ view, columnVisibility, columnConfig }: DebtTableProps) {
  const { debts, addDebt, updateDebt, deleteDebt, updateDebtOrder, toggleDebtPaid, isLoading } = useDebt();
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
  
  const sortedDebts = [...debts].sort((a,b) => a.order - b.order);

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
  
  const visibleColumns = Object.keys(columnConfig).filter(key => columnVisibility[key as keyof ColumnVisibility]);

  const renderLoadingSkeleton = () => (
    Array.from({ length: 3 }).map((_, i) => (
      <TableRow key={`skeleton-${i}`}>
        <TableCell colSpan={visibleColumns.length + 1}><Skeleton className="h-8 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const isCurrentView = view === 'current';

  const totalBalance = debts.reduce((acc, debt) => acc + (isCurrentView ? debt.balance : debt.nextBalance || 0), 0);
  const totalMinimumPayment = debts.reduce((acc, debt) => acc + (isCurrentView ? debt.minimumPayment : debt.nextMinimumPayment || 0), 0);
  const totalActualPayment = isCurrentView ? debts.reduce((acc, debt) => acc + debt.actualPayment, 0) : 0;

  return (
    <>
      <DebtForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addDebt={addDebt}
        updateDebt={updateDebt}
        editingDebt={editingDebt}
      />
      <div className="flex justify-end items-center mb-6 gap-2">
          <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Debt
          </Button>
      </div>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[24px] p-0"></TableHead>
                {Object.entries(columnConfig).map(([key, { label, isNumeric, isAction }]) => (
                    columnVisibility[key as keyof ColumnVisibility] && (
                        // Hide 'Actual Payment' for next month view
                        !(key === 'actualPayment' && !isCurrentView) &&
                        <TableHead key={key} className={cn(
                            isNumeric && "text-right",
                            isAction && "w-[100px] text-right",
                            key === 'paid' && "w-[50px]"
                        )}>{label}</TableHead>
                    )
                ))}
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
                          view={view}
                          onEdit={handleEdit} 
                          onDelete={deleteDebt}
                          onTogglePaid={toggleDebtPaid}
                          formatCurrency={formatCurrency}
                          columnVisibility={columnVisibility}
                      />
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={visibleColumns.length + 1} className="h-24 text-center">
                        No debts entered yet. Add one to get started!
                      </TableCell>
                    </TableRow>
                  )}
              </SortableContext>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={visibleColumns.indexOf('balance')}>Totals</TableCell>
                {columnVisibility.balance && <TableCell className="text-right font-semibold">{formatCurrency(totalBalance)}</TableCell>}
                {columnVisibility.minimumPayment && <TableCell className="text-right font-semibold">{formatCurrency(totalMinimumPayment)}</TableCell>}
                {columnVisibility.actualPayment && isCurrentView && <TableCell className="text-right font-bold">{formatCurrency(totalActualPayment)}</TableCell>}
                <TableCell colSpan={visibleColumns.filter(c => c !== 'balance' && c !== 'minimumPayment' && c !== 'actualPayment' && c !== 'name' && c !== 'paid').length - (isCurrentView ? 0 : 1) }></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </DndContext>
      </div>
    </>
  );
}
