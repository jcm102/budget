'use client';

import { useState } from 'react';
import { format, parse } from 'date-fns';
import { Pencil, Trash2, PlusCircle, GripVertical, Archive, ArchiveRestore } from 'lucide-react';
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
import { useDebt } from '../hooks/use-debt';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';


export type ColumnVisibility = {
    [key in keyof Debt | 'actions']?: boolean;
};

const parseDate = (dateString: string) => {
    if (!dateString) return new Date();
    const datePart = dateString.split('T')[0];
    return parse(datePart, 'yyyy-MM-dd', new Date());
};


type SortableDebtRowProps = {
  debt: Debt;
  onEdit: (debt: Debt) => void;
  onDelete: (id: string) => void;
  onTogglePaid: (id: string) => void;
  onArchive: (id: string, archived: boolean) => void;
  formatCurrency: (amount: number) => string;
  columnVisibility: ColumnVisibility;
};

function SortableDebtRow({ debt, onEdit, onDelete, onTogglePaid, onArchive, formatCurrency, columnVisibility }: SortableDebtRowProps) {
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

  const balance = debt.balance;
  const minPayment = debt.minimumPayment;
  const plannedPayment = debt.plannedPayment;
  const dueDate = debt.dueDate;
  const isPaid = debt.paid;
  const interestRate = debt.interestRate;
  const isArchived = debt.archived === true;

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes} className={cn(isPaid && "bg-accent/30 text-muted-foreground", isArchived && "border-l-4 border-l-amber-500 bg-amber-50/20")}>
        <TableCell className="w-[24px] p-0 pr-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 cursor-grab" {...listeners}>
                <GripVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
        </TableCell>
        {columnVisibility.paid && <TableCell>
            <Checkbox
              checked={isPaid}
              onCheckedChange={() => onTogglePaid(debt.id)}
              aria-label={`Mark ${debt.name} as paid`}
              className="mr-2"
            />
        </TableCell>}
        {columnVisibility.name && (
          <TableCell className={cn("font-medium", isPaid && "line-through")}>
            {debt.name} {isArchived && <span className="ml-1 text-xs text-amber-600 font-semibold">(Archived)</span>}
          </TableCell>
        )}
        {columnVisibility.debtType && <TableCell>{debt.debtType}</TableCell>}
        {columnVisibility.balance && <TableCell className="text-right">{formatCurrency(balance || 0)}</TableCell>}
        {columnVisibility.interestRate && <TableCell className="text-right">{interestRate ? `${interestRate}%` : '-'}</TableCell>}
        {columnVisibility.minimumPayment && <TableCell className="text-right">{formatCurrency(minPayment || 0)}</TableCell>}
        {columnVisibility.plannedPayment && <TableCell className="text-right font-bold">{formatCurrency(plannedPayment || 0)}</TableCell>}
        {columnVisibility.dueDate && <TableCell>{dueDate ? format(parseDate(dueDate), 'PPP') : '-'}</TableCell>}
        {columnVisibility.actions && <TableCell className="text-right">
        <div className="flex justify-end gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className={cn("h-8 w-8", isArchived ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-amber-600")}
              onClick={() => onArchive(debt.id, !isArchived)}
              title={isArchived ? "Restore from Archive" : "Archive Debt"}
            >
              {isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            </Button>
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
                    This action cannot be undone. This will permanently delete this debt entry and all its monthly logs from the database.
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
    month: string;
    includeArchived: boolean;
    columnVisibility: ColumnVisibility;
    columnConfig: Record<string, { label: string; isNumeric?: boolean; isAction?: boolean }>;
};

export function DebtTable({ month, includeArchived, columnVisibility, columnConfig }: DebtTableProps) {
  const { debts, addDebt, updateDebt, deleteDebt, updateDebtOrder, toggleDebtPaid, archiveDebt, setIncludeArchived, isLoading } = useDebt(month);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  // Sync state
  useState(() => {
    setIncludeArchived(includeArchived);
  });
  
  // Update hook's archiving setting if parent switches
  useState(() => {
    setIncludeArchived(includeArchived);
  });

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

  const totalBalance = debts.reduce((acc, debt) => acc + (debt.balance || 0), 0);
  const totalMinimumPayment = debts.reduce((acc, debt) => acc + (debt.minimumPayment || 0), 0);
  const totalPlannedPayment = debts.reduce((acc, debt) => acc + (debt.plannedPayment || 0), 0);
  
  const getColSpanForTotalsLabel = () => {
    let span = 0;
    if (columnVisibility.paid) span++;
    if (columnVisibility.name) span++;
    if (columnVisibility.debtType) span++;
    return span + 1; // +1 for the drag handle column
  }
  
  const getColSpanForTotalsSpacer = () => {
    let span = 0;
    if (columnVisibility.dueDate) span++;
    if (columnVisibility.actions) span++;
    if (columnVisibility.interestRate) span++;
    return span;
  }

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
                        <TableHead key={key} className={cn(
                            isNumeric && "text-right",
                            isAction && "w-[120px] text-right",
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
                          onEdit={handleEdit} 
                          onDelete={deleteDebt}
                          onTogglePaid={toggleDebtPaid}
                          onArchive={archiveDebt}
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
                <TableCell colSpan={getColSpanForTotalsLabel()} className="font-semibold text-right">Totals</TableCell>
                {columnVisibility.balance && <TableCell className="text-right font-semibold">{formatCurrency(totalBalance)}</TableCell>}
                {columnVisibility.interestRate && <TableCell></TableCell>}
                {columnVisibility.minimumPayment && <TableCell className="text-right font-semibold">{formatCurrency(totalMinimumPayment)}</TableCell>}
                {columnVisibility.plannedPayment && <TableCell className="text-right font-bold">{formatCurrency(totalPlannedPayment)}</TableCell>}
                <TableCell colSpan={getColSpanForTotalsSpacer()}></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </DndContext>
      </div>
    </>
  );
}
