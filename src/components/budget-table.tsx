'use client';

import { useState } from 'react';
import { Pencil, Trash2, PlusCircle } from 'lucide-react';
import type { BudgetItem, BudgetItemType } from '@/types';
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
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
import { BudgetForm } from './budget-form';
import { useBudget } from '@/hooks/use-budget';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';
import { Badge } from './ui/badge';

type BudgetCategory = {
  title: string;
  type: BudgetItemType;
  items: BudgetItem[];
};

export function BudgetTable() {
  const { budgetItems, addBudgetItem, updateBudgetItem, deleteBudgetItem, isLoading } = useBudget();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const getTypeVariant = (type: BudgetItem['type']) => {
    switch(type) {
      case 'income': return 'default';
      case 'savings': return 'secondary';
      case 'debt': return 'destructive';
      case 'transfer': return 'outline';
      default: return 'default';
    }
  }

  const renderLoadingSkeleton = () => (
    Array.from({ length: 4 }).map((_, i) => (
      <TableRow key={`skeleton-${i}`}>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
        <TableCell><Skeleton className="h-6 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const totalIncome = budgetItems.filter(i => i.type === 'income').reduce((acc, item) => acc + item.amount, 0);
  const totalSavings = budgetItems.filter(i => i.type === 'savings').reduce((acc, item) => acc + item.amount, 0);
  const totalDebt = budgetItems.filter(i => i.type === 'debt').reduce((acc, item) => acc + item.amount, 0);
  const totalTransfers = budgetItems.filter(i => i.type === 'transfer').reduce((acc, item) => acc + item.amount, 0);
  const totalOutgoing = totalSavings + totalDebt + totalTransfers;
  const netTotal = totalIncome - totalOutgoing;

  const budgetCategories: BudgetCategory[] = [
    { title: 'Income', type: 'income', items: budgetItems.filter(i => i.type === 'income') },
    { title: 'Savings', type: 'savings', items: budgetItems.filter(i => i.type === 'savings') },
    { title: 'Debt Payments', type: 'debt', items: budgetItems.filter(i => i.type === 'debt') },
    { title: 'Transfers', type: 'transfer', items: budgetItems.filter(i => i.type === 'transfer') },
  ];

  return (
    <>
      <BudgetForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addBudgetItem={addBudgetItem}
        updateBudgetItem={updateBudgetItem}
        editingItem={editingItem}
      />
      <div className="flex justify-between items-center mb-6 gap-2">
        <h2 className="text-3xl font-bold font-headline text-primary">Budget Overview</h2>
        <Button onClick={() => setIsFormOpen(true)}>
          <PlusCircle className="mr-2 h-5 w-5" />
          Add Item
        </Button>
      </div>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-4">
        <Accordion type="multiple" defaultValue={['income', 'savings', 'debt', 'transfer']} className="w-full">
          {budgetCategories.map(({ title, type, items }) => (
            <AccordionItem value={type} key={type}>
              <AccordionTrigger className="text-xl font-semibold hover:no-underline">
                <div className="flex items-center gap-4">
                  <span>{title}</span>
                  <Badge variant={getTypeVariant(type)} className="capitalize">{formatCurrency(items.reduce((acc, item) => acc + item.amount, 0))}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      {type === 'transfer' && <TableHead>Destination</TableHead>}
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-[100px] text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? renderLoadingSkeleton() : items.length > 0 ? (
                      items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          {type === 'transfer' && <TableCell>{item.destination || 'N/A'}</TableCell>}
                          <TableCell className="text-right">
                            {formatCurrency(item.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
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
                                      This will permanently delete this budget item.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteBudgetItem(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
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
                        <TableCell colSpan={type === 'transfer' ? 4 : 3} className="h-24 text-center">
                          No items in this category yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

       <div className="rounded-lg border bg-card text-card-foreground shadow-sm mt-6">
        <Table>
           <TableFooter>
            <TableRow>
              <TableCell className="font-semibold text-right">Total Income</TableCell>
              <TableCell className="text-right font-semibold text-green-600">{formatCurrency(totalIncome)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell className="font-semibold text-right">Total Outgoing</TableCell>
              <TableCell className="text-right font-semibold text-destructive">{formatCurrency(totalOutgoing)}</TableCell>
            </TableRow>
            <TableRow className="bg-muted/50">
              <TableCell className="font-bold text-right text-lg">Net</TableCell>
              <TableCell className={cn("text-right font-bold text-lg", netTotal >= 0 ? 'text-green-700' : 'text-destructive')}>{formatCurrency(netTotal)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </>
  );
}
