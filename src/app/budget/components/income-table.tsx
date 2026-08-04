

'use client';

import { useState, useMemo } from 'react';
import { format, parse, addMonths } from 'date-fns';
import { Pencil, Trash2, PlusCircle, Repeat, ArrowUpDown, ArrowRight } from 'lucide-react';
import type { BudgetItem } from '@/types';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
import { BudgetForm } from '@/app/budget/components/budget-form';
import { useAccountDetails } from '@/hooks/use-transferees';
import { useFirestore } from '@/firebase';
import * as MonthlyBudgetService from '@/app/monthly-budget/services/monthly-budget-service';
import { getDocs, collection } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Check } from 'lucide-react';
import { useBudget } from '@/app/budget/hooks/use-budget';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type SortConfig = {
    key: keyof BudgetItem;
    direction: 'ascending' | 'descending';
} | null;

const parseDate = (dateString: string) => {
    return parse(dateString.split('T')[0], 'yyyy-MM-dd', new Date());
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const SortableHeader = ({ column, label, sortConfig, requestSort, className }: { column: keyof BudgetItem, label: string, sortConfig: SortConfig, requestSort: (key: keyof BudgetItem) => void, className?: string }) => {
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

function IncomeTableContent({ items, isLoading, onEdit, onDelete, onReceive }: {
    items: BudgetItem[],
    isLoading: boolean,
    onEdit: (item: BudgetItem) => void,
    onDelete: (id: string) => void,
    onReceive: (item: BudgetItem) => void,
}) {
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'date', direction: 'ascending' });

    const requestSort = (key: keyof BudgetItem) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const sortedItems = useMemo(() => {
        let sortableItems = [...items];
        if (sortConfig !== null) {
        sortableItems.sort((a, b) => {
            let aValue: any, bValue: any;

            if (sortConfig.key === 'date') {
                aValue = new Date(a.date).getTime();
                bValue = new Date(b.date).getTime();
            } else {
                aValue = a[sortConfig.key as keyof BudgetItem];
                bValue = b[sortConfig.key as keyof BudgetItem];
            }

            if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        });
        }
        return sortableItems;
    }, [items, sortConfig]);

    const renderLoadingSkeleton = () => (
        Array.from({ length: 2 }).map((_, i) => (
        <TableRow key={`skeleton-income-${i}`}>
            <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
        </TableRow>
        ))
    );

    const total = items.reduce((acc, item) => acc + item.amount, 0);

    return (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <Table>
                <TableHeader>
                    <TableRow className="group">
                        <SortableHeader column="description" label="Description" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader column="category" label="Category" sortConfig={sortConfig} requestSort={requestSort} />
                        <SortableHeader column="date" label="Date" sortConfig={sortConfig} requestSort={requestSort} />
                        <TableHead>Frequency</TableHead>
                        <SortableHeader column="amount" label="Amount" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                        <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : sortedItems.length > 0 ? (
                    sortedItems.map((item) => (
                    <TableRow key={item.id} data-state={item.completed ? "completed" : ""} className={item.completed ? "bg-accent/30 text-muted-foreground" : ""}>
                        <TableCell className="font-medium">
                            {item.description}
                        </TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{format(parseDate(item.date), 'PPP')}</TableCell>
                        <TableCell>
                        {item.frequency !== 'One-Time' ? (
                            <Badge variant="secondary" className="gap-1 items-center">
                            <Repeat className="h-3 w-3" /> {item.frequency}
                            </Badge>
                        ) : (
                            <Badge variant="outline">One-Time</Badge>
                        )}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                        <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(item)}>
                            <Pencil className="h-4 w-4" />
                            </Button>
                            {!item.completed && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => onReceive(item)} title="Receive Income">
                                <Check className="h-4 w-4" />
                                </Button>
                            )}
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
                                    This will permanently delete this budget item.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
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
                    <TableCell colSpan={6} className="h-24 text-center">
                        No income items added yet.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={5} className="font-semibold text-right">Total</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(total)}</TableCell>
                    </TableRow>
                </TableFooter>
            </Table>
        </div>
    )
}

export function IncomeTable({ month, onMutation }: { month: string, onMutation?: () => void }) {
  const { budgetItems, addBudgetItem, updateBudgetItem, deleteBudgetItem, isLoading } = useBudget(month, onMutation);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);

  const { accounts, fetchAccounts } = useAccountDetails();
  const { toast } = useToast();
  const db = useFirestore();
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  const [paymentConfirmIncome, setPaymentConfirmIncome] = useState<BudgetItem | null>(null);
  const [paymentDestAccountId, setPaymentDestAccountId] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'));
  const [paymentCategoryId, setPaymentCategoryId] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);

  // Load categories
  useMemo(() => {
    if (!db) return;
    const loadCats = async () => {
      try {
        const snap = await getDocs(collection(db, 'budget-categories'));
        const list = snap.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
        setCategories(list);
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    };
    loadCats();
  }, [db]);

  const handleReceive = (item: BudgetItem) => {
    setPaymentConfirmIncome(item);
    setPaymentAmount(item.amount);
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    
    // Use the category already assigned to this budget item
    setPaymentCategoryId(item.budgetCategoryId || '');
    
    if (accounts.length > 0) {
      const preferredAccount = accounts.find(acc => acc.name.toLowerCase().includes('chequing') || acc.name.toLowerCase().includes('savings')) || accounts[0];
      setPaymentDestAccountId(preferredAccount.id);
    } else {
      setPaymentDestAccountId('');
    }
  };

  const handleConfirmReceive = async () => {
    if (!paymentConfirmIncome || !db) return;
    setIsSubmittingPayment(true);
    try {
      const transactionData = {
        description: `Income: ${paymentConfirmIncome.description}`,
        amount: paymentAmount,
        date: paymentDate,
        splits: [{
          id: Math.random().toString(36).substring(2, 9),
          type: 'income',
          amount: paymentAmount,
          categoryId: paymentCategoryId || undefined,
          budgetItemName: paymentConfirmIncome.description,
          destinationAccountId: paymentDestAccountId || undefined,
        }],
      };

      const createdTx = await MonthlyBudgetService.addTransaction(db, transactionData as any);
      await updateBudgetItem(paymentConfirmIncome.id, { completed: true, transactionId: createdTx.id });
      await fetchAccounts();

      toast({
        title: 'Income Logged!',
        description: `Logged ${formatCurrency(paymentAmount)} to your ledger.`,
      });

      setPaymentConfirmIncome(null);
    } catch (error) {
      console.error('Failed to log income transaction:', error);
      toast({
        title: 'Error logging income',
        description: 'Failed to record transaction in your ledger.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingPayment(false);
    }
  };


  const currentMonthLabel = format(parse(month + '-01', 'yyyy-MM-dd', new Date()), 'MMMM');
  const nextMonthLabel = format(addMonths(parse(month + '-01', 'yyyy-MM-dd', new Date()), 1), 'MMMM');

  const { currentMonthItems, nextMonthItems } = useMemo(() => {
    const allIncome = budgetItems.filter(item => item.type === 'Income');
    return {
      currentMonthItems: allIncome.filter(item => !item.isNextMonthView),
      nextMonthItems: allIncome.filter(item => item.isNextMonthView),
    }
  }, [budgetItems]);

  const handleEdit = (item: BudgetItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleFormOpenChange = (isOpen: boolean) => {
    setIsFormOpen(isOpen);
    if (!isOpen) {
      setEditingItem(null);
    }
  };
  
  return (
    <>
      {paymentConfirmIncome && (
        <Dialog open={!!paymentConfirmIncome} onOpenChange={(open) => !open && setPaymentConfirmIncome(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Receive Income: {paymentConfirmIncome.description}</DialogTitle>
              <DialogDescription>
                Select the destination account where this money was deposited.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="dest-account" className="text-right">Account</Label>
                <div className="col-span-3">
                  <Select value={paymentDestAccountId} onValueChange={setPaymentDestAccountId}>
                    <SelectTrigger id="dest-account">
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


              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  className="col-span-3"
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="date" className="text-right">Date</Label>
                <Input
                  id="date"
                  type="date"
                  className="col-span-3"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentConfirmIncome(null)} disabled={isSubmittingPayment}>Cancel</Button>
              <Button onClick={handleConfirmReceive} disabled={isSubmittingPayment || !paymentDestAccountId}>
                {isSubmittingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Log Income'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <BudgetForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addBudgetItem={addBudgetItem}
        updateBudgetItem={updateBudgetItem}
        editingItem={editingItem}
        month={month}
      />
      <div className="flex justify-end items-center mb-6 gap-2 no-print">
        <Button onClick={() => setIsFormOpen(true)}>
          <PlusCircle className="mr-2 h-5 w-5" />
          Add Budget Item
        </Button>
      </div>
      <Tabs defaultValue="current" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-secondary/50 mb-6 no-print">
            <TabsTrigger value="current">{currentMonthLabel}</TabsTrigger>
            <TabsTrigger value="next">{nextMonthLabel}</TabsTrigger>
        </TabsList>
        <TabsContent value="current">
            <IncomeTableContent 
                items={currentMonthItems}
                isLoading={isLoading}
                onEdit={handleEdit}
                onDelete={deleteBudgetItem}
                onReceive={handleReceive}
            />
        </TabsContent>
        <TabsContent value="next">
            <IncomeTableContent 
                items={nextMonthItems}
                isLoading={isLoading}
                onEdit={handleEdit}
                onDelete={deleteBudgetItem}
                onReceive={handleReceive}
            />
        </TabsContent>
      </Tabs>
    </>
  );
}
