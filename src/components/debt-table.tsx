
'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2, PlusCircle, RotateCcw, GripVertical, View } from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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


type ColumnVisibility = {
    [key in keyof Debt | 'actions']?: boolean;
};


type SortableDebtRowProps = {
  debt: Debt;
  onEdit: (debt: Debt) => void;
  onDelete: (id: string) => void;
  onTogglePaid: (id: string) => void;
  formatCurrency: (amount: number) => string;
  columnVisibility: ColumnVisibility;
};

function SortableDebtRow({ debt, onEdit, onDelete, onTogglePaid, formatCurrency, columnVisibility }: SortableDebtRowProps) {
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
    <TableRow ref={setNodeRef} style={style} {...attributes} className={cn(debt.paid && "bg-accent/30 text-muted-foreground")}>
        <TableCell className="w-[24px] p-0 pr-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 cursor-grab" {...listeners}>
                <GripVertical className="h-4 w-4 text-muted-foreground" />
            </Button>
        </TableCell>
        {columnVisibility.paid && <TableCell>
            <Checkbox
              checked={debt.paid}
              onCheckedChange={() => onTogglePaid(debt.id)}
              aria-label={`Mark ${debt.name} as paid`}
              className="mr-2"
            />
        </TableCell>}
        {columnVisibility.name && <TableCell className={cn("font-medium", debt.paid && "line-through")}>{debt.name}</TableCell>}
        {columnVisibility.balance && <TableCell className="text-right">{formatCurrency(debt.balance)}</TableCell>}
        {columnVisibility.minimumPayment && <TableCell className="text-right">{formatCurrency(debt.minimumPayment)}</TableCell>}
        {columnVisibility.actualPayment && <TableCell className="text-right font-bold">{formatCurrency(debt.actualPayment)}</TableCell>}
        {columnVisibility.dueDate && <TableCell>{format(new Date(debt.dueDate), 'PPP')}</TableCell>}
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
        </TableCell>}
    </TableRow>
  );
}


export function DebtTable() {
  const { debts, addDebt, updateDebt, deleteDebt, resetDebtValues, updateDebtOrder, toggleDebtPaid, isLoading } = useDebt();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    paid: true,
    name: true,
    balance: true,
    minimumPayment: true,
    actualPayment: true,
    dueDate: true,
    actions: true,
  });

  const columnConfig = {
    paid: { label: 'Paid' },
    name: { label: 'Debt Name' },
    balance: { label: 'Balance', isNumeric: true },
    minimumPayment: { label: 'Min. Payment', isNumeric: true },
    actualPayment: { label: 'Actual Payment', isNumeric: true },
    dueDate: { label: 'Due Date' },
    actions: { label: 'Actions', isAction: true },
  };


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

  const totalBalance = debts.reduce((acc, debt) => acc + debt.balance, 0);
  const totalMinimumPayment = debts.reduce((acc, debt) => acc + debt.minimumPayment, 0);
  const totalActualPayment = debts.reduce((acc, debt) => acc + debt.actualPayment, 0);

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
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <View className="mr-2 h-4 w-4" />
                  View
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(columnConfig).map(([key, { label }]) => (
                   <DropdownMenuCheckboxItem
                    key={key}
                    className="capitalize"
                    checked={columnVisibility[key as keyof ColumnVisibility]}
                    onCheckedChange={(value) =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        [key]: !!value,
                      }))
                    }
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
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
                {Object.entries(columnConfig).map(([key, { label, isNumeric, isAction }]) => (
                    columnVisibility[key as keyof ColumnVisibility] && (
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
                {columnVisibility.actualPayment && <TableCell className="text-right font-bold">{formatCurrency(totalActualPayment)}</TableCell>}
                <TableCell colSpan={visibleColumns.filter(c => c !== 'balance' && c !== 'minimumPayment' && c !== 'actualPayment' && c !== 'name' && c !== 'paid').length}></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </DndContext>
      </div>
    </>
  );
}
