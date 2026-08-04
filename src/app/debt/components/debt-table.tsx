'use client';

import { useState, useMemo, useEffect } from 'react';
import { format, parse } from 'date-fns';
import { Pencil, Trash2, PlusCircle, GripVertical, Archive, ArchiveRestore, Loader2 } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DebtForm } from './debt-form';
import { useDebt } from '../hooks/use-debt';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useAccountDetails } from '@/hooks/use-transferees';
import { useFirestore } from '@/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import * as MonthlyBudgetService from '@/app/monthly-budget/services/monthly-budget-service';
import { useToast } from '@/hooks/use-toast';


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
  onToggleScheduled: (id: string) => void;
  onArchive: (id: string, archived: boolean) => void;
  formatCurrency: (amount: number) => string;
  columnVisibility: ColumnVisibility;
};

function SortableDebtRow({ debt, onEdit, onDelete, onTogglePaid, onToggleScheduled, onArchive, formatCurrency, columnVisibility }: SortableDebtRowProps) {
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
        {columnVisibility.scheduled && <TableCell>
            <Checkbox
              checked={debt.scheduled ?? false}
              onCheckedChange={() => onToggleScheduled(debt.id)}
              aria-label={`Mark ${debt.name} payment as scheduled`}
              className="mr-2"
            />
        </TableCell>}
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
  const { debts, addDebt, updateDebt, deleteDebt, updateDebtOrder, toggleDebtPaid, toggleDebtScheduled, archiveDebt, setIncludeArchived, isLoading } = useDebt(month);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  const { accounts, fetchAccounts } = useAccountDetails();
  const { toast } = useToast();
  const db = useFirestore();
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const [paymentConfirmDebt, setPaymentConfirmDebt] = useState<Debt | null>(null);
  const [paymentSourceAccountId, setPaymentSourceAccountId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [paymentCategoryId, setPaymentCategoryId] = useState<string>('');
  const [paymentPayee, setPaymentPayee] = useState<string>('');
  const [paymentDescription, setPaymentDescription] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  useEffect(() => {
    if (!db) return;
    const loadCats = async () => {
      try {
        const snap = await getDocs(collection(db, 'budget-categories'));
        const list = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
        setCategories(list);
      } catch (err) {
        console.error('Failed to load categories in debt table:', err);
      }
    };
    loadCats();
  }, [db]);

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

  const handleTogglePaidClick = (id: string) => {
    const debt = debts.find(d => d.id === id);
    if (!debt) return;
    
    if (!debt.paid) {
      // Toggle from unpaid -> paid: Open confirmation dialog
      const initialAmount = debt.plannedPayment || debt.minimumPayment || 0;
      setPaymentConfirmDebt(debt);
      setPaymentAmount(initialAmount);
      setPaymentPayee(debt.name);
      setPaymentDescription(`Payment: ${debt.name}`);
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      
      // Pre-select category based on debtType if untracked, or linked account if tracked
      const linkedAccount = accounts.find(acc => acc.linkedDebtId === debt.id);
      if (linkedAccount) {
        setPaymentCategoryId(''); // not needed for transfers
      } else {
        const targetCategoryName = debt.debtType === 'Credit Card' ? 'Credit Cards' : 
                                   debt.debtType === 'Loan' ? 'Loans' : 
                                   debt.debtType === 'Line of Credit' ? 'Line of Credit' : '';
        const defaultCat = categories.find(c => c.name.toLowerCase() === targetCategoryName.toLowerCase());
        setPaymentCategoryId(defaultCat?.id || '');
      }
      
      // Select first transferee account as default source if any exist
      if (accounts.length > 0) {
        const preferredAccount = accounts.find(acc => acc.name.toLowerCase().includes('chequing') || acc.name.toLowerCase().includes('savings')) || accounts[0];
        setPaymentSourceAccountId(preferredAccount.id);
      } else {
        setPaymentSourceAccountId('');
      }
    } else {
      // Toggle back to unpaid directly
      toggleDebtPaid(id);
    }
  };

  const handleConfirmPayment = async () => {
    if (!paymentConfirmDebt || !db) return;
    setIsSubmittingPayment(true);
    try {
      const linkedAccount = accounts.find(acc => acc.linkedDebtId === paymentConfirmDebt.id);
      let splits = [];
      if (linkedAccount) {
        // Transfer split
        splits.push({
          id: Math.random().toString(36).substring(2, 9),
          type: 'transfer' as const,
          amount: paymentAmount,
          destinationAccountId: linkedAccount.id,
        });
      } else {
        // Expense split
        splits.push({
          id: Math.random().toString(36).substring(2, 9),
          type: 'expense' as const,
          amount: paymentAmount,
          categoryId: paymentCategoryId || undefined,
          budgetItemName: paymentConfirmDebt.name,
        });
      }

      const transactionData = {
        description: paymentDescription,
        payee: paymentPayee,
        amount: paymentAmount,
        date: paymentDate,
        sourceAccountId: paymentSourceAccountId || undefined,
        splits,
      };

      // 1. Log transaction in global ledger
      await MonthlyBudgetService.addTransaction(db, transactionData);
      
      // 2. Mark debt as paid in sheet
      await toggleDebtPaid(paymentConfirmDebt.id);

      // 3. Force refetch accounts to reflect new balances immediately
      await fetchAccounts();

      toast({
        title: 'Payment Logged!',
        description: `Logged payment of ${formatCurrency(paymentAmount)} to "${paymentConfirmDebt.name}" in your ledger.`,
      });

      setPaymentConfirmDebt(null);
    } catch (error) {
      console.error('Failed to log payment transaction:', error);
      toast({
        title: 'Error logging payment',
        description: 'Failed to record payment transaction in your ledger.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleMarkPaidOnly = async () => {
    if (!paymentConfirmDebt) return;
    try {
      await toggleDebtPaid(paymentConfirmDebt.id);
      toast({
        title: 'Debt Marked Paid',
        description: `"${paymentConfirmDebt.name}" marked as paid without creating a ledger transaction.`,
      });
      setPaymentConfirmDebt(null);
    } catch (error) {
      console.error('Failed to mark paid:', error);
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
    if (columnVisibility.scheduled) span++;
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

      {paymentConfirmDebt && (
        <Dialog open={!!paymentConfirmDebt} onOpenChange={(open) => !open && setPaymentConfirmDebt(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Record Payment: {paymentConfirmDebt.name}</DialogTitle>
              <DialogDescription>
                Select the payment details. This will mark the debt as paid in your worksheet and create a transaction in your ledger.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Source Account Select */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="source-account" className="text-right">
                  Source Account
                </Label>
                <div className="col-span-3">
                  <Select value={paymentSourceAccountId} onValueChange={setPaymentSourceAccountId}>
                    <SelectTrigger id="source-account">
                      <SelectValue placeholder="Select account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {acc.name} ({formatCurrency(acc.balance || 0)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Mapped Category or Destination Account Link info */}
              {(() => {
                const linkedAccount = accounts.find(acc => acc.linkedDebtId === paymentConfirmDebt.id);
                if (linkedAccount) {
                  return (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <div className="text-right text-xs font-semibold text-muted-foreground">
                        Type
                      </div>
                      <div className="col-span-3 text-xs text-muted-foreground">
                        Transfer to <strong>{linkedAccount.name}</strong> account.
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="category" className="text-right">
                        Category
                      </Label>
                      <div className="col-span-3">
                        <Select value={paymentCategoryId} onValueChange={setPaymentCategoryId}>
                          <SelectTrigger id="category">
                            <SelectValue placeholder="Select category..." />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>
                                {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                }
              })()}

              {/* Amount Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">
                  Amount
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  className="col-span-3"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                />
              </div>

              {/* Date Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="date" className="text-right">
                  Date
                </Label>
                <Input
                  id="date"
                  type="date"
                  className="col-span-3"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>

              {/* Payee Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="payee" className="text-right">
                  Payee
                </Label>
                <Input
                  id="payee"
                  className="col-span-3"
                  value={paymentPayee}
                  onChange={(e) => setPaymentPayee(e.target.value)}
                />
              </div>

              {/* Description Input */}
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="description" className="text-right">
                  Description
                </Label>
                <Input
                  id="description"
                  className="col-span-3"
                  value={paymentDescription}
                  onChange={(e) => setPaymentDescription(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
              <Button variant="ghost" className="sm:mr-auto text-xs text-muted-foreground hover:text-foreground" onClick={handleMarkPaidOnly} disabled={isSubmittingPayment}>
                Mark Paid Only
              </Button>
              <Button variant="outline" onClick={() => setPaymentConfirmDebt(null)} disabled={isSubmittingPayment}>
                Cancel
              </Button>
              <Button onClick={handleConfirmPayment} disabled={isSubmittingPayment || !paymentSourceAccountId}>
                {isSubmittingPayment ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin animate-infinite" />
                    Saving...
                  </>
                ) : (
                  'Confirm Payment'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
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
                            (key === 'paid' || key === 'scheduled') && "w-[50px]"
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
                          onTogglePaid={handleTogglePaidClick}
                          onToggleScheduled={toggleDebtScheduled}
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
