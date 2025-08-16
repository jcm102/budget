
'use client';

import { useState, useMemo } from 'react';
import { Pencil, Trash2, PlusCircle, ArrowUpDown, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import type { Goal } from '@/types';

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
import { GoalForm } from './goal-form';
import { useGoals } from '@/hooks/use-goals';
import { Skeleton } from './ui/skeleton';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';
import { Progress } from './ui/progress';

type SortConfig = {
    key: keyof Goal | 'progress';
    direction: 'ascending' | 'descending';
} | null;

const SortableHeader = ({ column, label, sortConfig, requestSort, className }: { column: SortConfig['key'], label: string, sortConfig: SortConfig, requestSort: (key: SortConfig['key']) => void, className?: string }) => {
  const isSorted = sortConfig?.key === column;
  const direction = isSorted ? sortConfig.direction : 'ascending';
  return (
    <TableHead className={className}>
      <Button variant="ghost" onClick={() => requestSort(column)}>
        {label}
        {isSorted && <ArrowUpDown className={'ml-2 h-4 w-4 transform ${direction === \'descending\' ? \'rotate-180\' : \'\'}'} />}
        {!isSorted && <ArrowUpDown className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-50" />}
      </Button>
    </TableHead>
  )
}

export function GoalTable() {
  const { goals, addGoal, updateGoal, deleteGoal, isLoading } = useGoals();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Goal | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });

  const handleEdit = (item: Goal) => {
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

  const requestSort = (key: SortConfig['key']) => {
    if (!key) return;
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const sortedItems = useMemo(() => {
    let sortableItems = [...goals];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: any, bValue: any;

        if(sortConfig.key === 'progress') {
            aValue = a.cost > 0 ? (a.amount / a.cost) * 100 : 0;
            bValue = b.cost > 0 ? (b.amount / b.cost) * 100 : 0;
        } else {
            aValue = a[sortConfig.key as keyof Goal];
            bValue = b[sortConfig.key as keyof Goal];
        }


        if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [goals, sortConfig]);

  const renderLoadingSkeleton = () => (
    Array.from({ length: 2 }).map((_, i) => (
      <TableRow key={`skeleton-goal-table-${i}`}>
        <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const totalAllocated = goals.reduce((acc, goal) => acc + goal.amount, 0);
  const totalCost = goals.reduce((acc, goal) => acc + goal.cost, 0);

  return (
    <>
      <GoalForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addGoal={addGoal}
        updateGoal={updateGoal}
        editingItem={editingItem}
      />
      <div className="flex justify-end items-center mb-6 gap-2">
          <Button onClick={() => setIsFormOpen(true)}>
            <PlusCircle className="mr-2 h-5 w-5" />
            Add Goal
          </Button>
      </div>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="group">
                <SortableHeader column="name" label="Goal Name" sortConfig={sortConfig} requestSort={requestSort} />
                <SortableHeader column="cost" label="Total Cost" sortConfig={sortConfig} requestSort={requestSort} className="text-right"/>
                <SortableHeader column="amount" label="Amount Saved" sortConfig={sortConfig} requestSort={requestSort} className="text-right"/>
                <SortableHeader column="progress" label="Progress" sortConfig={sortConfig} requestSort={requestSort}/>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : sortedItems.length > 0 ? (
                    sortedItems.map((item) => {
                        const progress = item.cost > 0 ? (item.amount / item.cost) * 100 : 0;
                        return (
                        <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.cost)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.amount)}</TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Progress value={progress} className="w-[60%]" />
                                    <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                    {item.link && (
                                      <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                        <Link href={item.link} target="_blank" rel="noopener noreferrer"><LinkIcon className="h-4 w-4"/></Link>
                                      </Button>
                                    )}
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(item)}><Pencil className="h-4 w-4" /></Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this savings goal.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteGoal(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>Delete</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </TableCell>
                        </TableRow>
                        )
                    })
                ) : (
                    <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                        No goals created yet. Add one to get started!
                    </TableCell>
                    </TableRow>
                )}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold text-right">Totals</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totalCost)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(totalAllocated)}</TableCell>
                <TableCell colSpan={2}></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
      </div>
    </>
  );
}
