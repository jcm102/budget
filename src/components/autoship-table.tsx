
'use client';

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2, PlusCircle, RotateCw, ArrowUpDown, PiggyBank } from 'lucide-react';
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
import { useSavings } from '@/hooks/use-savings';
import { useMonthlyBudget } from '@/hooks/use-monthly-budget';
import { CreateSinkingFundDialog } from './create-sinking-fund-dialog';


type SortConfig = {
    key: keyof AutoShipItem | 'monthlyCost';
    direction: 'ascending' | 'descending';
} | null;

const getMonthlyCost = (item: AutoShipItem) => {
    const frequencyMap = {
        'Monthly': 1,
        'Every 2 Months': 2,
        'Every 3 Months': 3,
        'Every 4 Months': 4,
        'Every 6 Months': 6,
    };
    const months = frequencyMap[item.frequency];
    return item.estimatedCost / months;
};

const SortableHeader = ({ column, label, sortConfig, requestSort, className }: { column: keyof AutoShipItem | 'monthlyCost', label: string, sortConfig: SortConfig, requestSort: (key: keyof AutoShipItem | 'monthlyCost') => void, className?: string }) => {
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

export function AutoShipTable() {
  const { autoShipItems, addAutoShipItem, updateAutoShipItem, deleteAutoShipItem, shipItem, isLoading } = useAutoShip();
  const { addSavingsItem, savingsItems } = useSavings();
  const { categories: budgetCategories, budgetItems, updateBudgetItemWithBreakdown } = useMonthlyBudget();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AutoShipItem | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'nextShipmentDate', direction: 'ascending' });
  const { toast } = useToast();
  const [sinkingFundCandidate, setSinkingFundCandidate] = useState<AutoShipItem | null>(null);


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
  
  const requestSort = (key: keyof AutoShipItem | 'monthlyCost') => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const sortedItems = useMemo(() => {
    let sortableItems = [...autoShipItems];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue, bValue;
        if (sortConfig.key === 'nextShipmentDate') {
            aValue = new Date(a.nextShipmentDate).getTime();
            bValue = new Date(b.nextShipmentDate).getTime();
        } else if (sortConfig.key === 'monthlyCost') {
            aValue = getMonthlyCost(a);
            bValue = getMonthlyCost(b);
        } else {
            aValue = a[sortConfig.key as keyof AutoShipItem];
            bValue = b[sortConfig.key as keyof AutoShipItem];
        }

        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [autoShipItems, sortConfig]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const handleCreateSinkingFund = (item: AutoShipItem, categoryId: string) => {
    const fundExists = savingsItems.some(fund => fund.name.toLowerCase() === item.item.toLowerCase());
    const monthlyCost = getMonthlyCost(item);

    if (!fundExists) {
        addSavingsItem({ 
            name: item.item, 
            amount: 0, 
            goal: monthlyCost,
            totalCost: item.estimatedCost,
            dueDate: item.nextShipmentDate,
            accountId: item.accountId,
            currency: 'CAD', // Assuming CAD
        });
    }

    const budgetCategory = budgetCategories.find(c => c.id === categoryId);
    if (budgetCategory) {
        const budgetItem = budgetItems.find(b => b.categoryId === budgetCategory.id);
        const newBreakdownItem = { name: item.item, amount: monthlyCost };
        const existingBreakdown = budgetItem?.breakdown?.filter(b => b.name !== 'Default') || [];
        const newBreakdown = [...existingBreakdown, newBreakdownItem];
        updateBudgetItemWithBreakdown(budgetCategory.id, newBreakdown);
    }

    toast({ title: 'Sinking Fund Linked', description: `"${item.item}" has been added to your monthly budget.` });
    setSinkingFundCandidate(null);
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
        <TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell>
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
      {sinkingFundCandidate && (
        <CreateSinkingFundDialog
          open={!!sinkingFundCandidate}
          onOpenChange={() => setSinkingFundCandidate(null)}
          item={sinkingFundCandidate}
          itemType="Auto-Shipment"
          onConfirm={(categoryId) => handleCreateSinkingFund(sinkingFundCandidate, categoryId)}
        />
      )}
      <div className="flex justify-end items-center mb-6 gap-2">
          <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Auto-Ship Item
          </Button>
      </div>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="group">
                <SortableHeader column="item" label="Item" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader column="nextShipmentDate" label="Next Shipment" sortConfig={sortConfig} requestSort={requestSort} />
                <TableHead>Frequency</TableHead>
                <SortableHeader column="estimatedCost" label="Estimated Cost" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                <SortableHeader column="monthlyCost" label="Monthly Cost" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                <TableHead className="w-[180px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : sortedItems.length > 0 ? (
                    sortedItems.map((item) => (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.item}</TableCell>
                            <TableCell>{format(new Date(item.nextShipmentDate), 'PPP')}</TableCell>
                            <TableCell><Badge variant="secondary">{item.frequency}</Badge></TableCell>
                            <TableCell className="text-right">{formatCurrency(item.estimatedCost)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(getMonthlyCost(item))}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Create Sinking Fund" onClick={() => setSinkingFundCandidate(item)}>
                                        <PiggyBank className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Ship Item" onClick={() => handleShipItem(item)}>
                                        <RotateCw className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit Item" onClick={() => handleEdit(item)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" title="Delete Item">
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
                    <TableCell colSpan={6} className="h-24 text-center">
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
