
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { format, differenceInCalendarMonths, startOfDay, isBefore } from 'date-fns';
import { Pencil, Trash2, PlusCircle, DollarSign, Calendar, Target, Repeat, ArrowUpDown, Link as LinkIcon } from 'lucide-react';
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
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';

type SortConfig = {
    key: keyof Goal | 'remainingAmount' | 'monthlyContribution';
    direction: 'ascending' | 'descending';
} | null;

const SortableHeader = ({ column, label, sortConfig, requestSort, className }: { column: SortConfig['key'], label: string, sortConfig: SortConfig, requestSort: (key: SortConfig['key']) => void, className?: string }) => {
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
  
  const calculateFixedGoalValues = (goal: Goal) => {
    const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;
    const remainingAmount = goal.targetAmount - goal.currentAmount;
    
    let monthlyContribution = 0;
    if (goal.targetDate) {
      const now = startOfDay(new Date());
      const target = startOfDay(new Date(goal.targetDate));
      
      if (isBefore(now, target)) {
        const monthsRemaining = differenceInCalendarMonths(target, now);
        if (remainingAmount > 0 && monthsRemaining > 0) {
          monthlyContribution = remainingAmount / monthsRemaining;
        } else if (remainingAmount > 0 && monthsRemaining <= 0) {
            monthlyContribution = remainingAmount;
        }
      } else if (remainingAmount > 0) {
          monthlyContribution = remainingAmount;
      }
    }

    return { progress, remainingAmount, monthlyContribution };
  }

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

        if (sortConfig.key === 'remainingAmount') {
          aValue = a.goalType === 'fixed' ? calculateFixedGoalValues(a).remainingAmount : a.currentAmount;
          bValue = b.goalType === 'fixed' ? calculateFixedGoalValues(b).remainingAmount : b.currentAmount;
        } else if (sortConfig.key === 'monthlyContribution') {
          aValue = a.goalType === 'fixed' ? calculateFixedGoalValues(a).monthlyContribution : a.monthlyContribution || 0;
          bValue = b.goalType === 'fixed' ? calculateFixedGoalValues(b).monthlyContribution : b.monthlyContribution || 0;
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
      <TableRow key={`skeleton-goal-${i}`}>
        <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const totalCurrentAmount = goals.reduce((acc, goal) => acc + goal.currentAmount, 0);
  
  const totalTargetAmount = goals
    .filter(g => g.goalType === 'fixed')
    .reduce((acc, goal) => acc + goal.targetAmount, 0);
    
  const totalRequiredMonthly = goals.reduce((acc, goal) => {
    if (goal.goalType === 'fixed') {
      return acc + calculateFixedGoalValues(goal).monthlyContribution;
    }
    if (goal.goalType === 'monthly') {
      return acc + (goal.monthlyContribution || 0);
    }
    return acc;
  }, 0);


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
            Add Savings Goal
          </Button>
      </div>

      <Card className="mb-8">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-4">
                <Target className="h-8 w-8 text-primary" />
                <div>
                    <p className="text-muted-foreground">Total Fixed Goal</p>
                    <p className="text-xl font-semibold">{formatCurrency(totalTargetAmount)}</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <DollarSign className="h-8 w-8 text-green-500" />
                <div>
                    <p className="text-muted-foreground">Total Saved</p>
                    <p className="text-xl font-semibold">{formatCurrency(totalCurrentAmount)}</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <Calendar className="h-8 w-8 text-blue-500" />
                <div>
                    <p className="text-muted-foreground">Required Monthly Savings</p>
                    <p className="text-xl font-semibold">{formatCurrency(totalRequiredMonthly)}</p>
                </div>
            </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="group">
                <SortableHeader column="name" label="Goal" sortConfig={sortConfig} requestSort={requestSort} />
                <TableHead className="w-[200px]">Progress</TableHead>
                <TableHead>Target/Frequency</TableHead>
                <SortableHeader column="monthlyContribution" label="Monthly Contribution" sortConfig={sortConfig} requestSort={requestSort} className="text-right"/>
                <SortableHeader column="remainingAmount" label="Remaining/Saved" sortConfig={sortConfig} requestSort={requestSort} className="text-right" />
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : sortedItems.length > 0 ? (
                    sortedItems.map((item) => {
                        if (item.goalType === 'monthly') {
                            return (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium flex items-center gap-2">
                                        {item.name}
                                        {item.url && (
                                            <Button asChild variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">
                                                <Link href={item.url} target="_blank" rel="noopener noreferrer">
                                                    <LinkIcon className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                        )}
                                    </TableCell>
                                    <TableCell></TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="gap-1 items-center">
                                            <Repeat className="h-3 w-3" /> Monthly
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">{formatCurrency(item.monthlyContribution || 0)}</TableCell>
                                    <TableCell className="text-right">{formatCurrency(item.currentAmount)}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
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
                        }

                        const { progress, remainingAmount, monthlyContribution } = calculateFixedGoalValues(item);
                        return (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        {item.name}
                                        {item.url && (
                                            <Button asChild variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">
                                                <Link href={item.url} target="_blank" rel="noopener noreferrer">
                                                    <LinkIcon className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                        )}
                                    </div>
                                    <div className="text-xs text-muted-foreground">{formatCurrency(item.currentAmount)} / {formatCurrency(item.targetAmount)}</div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Progress value={progress} className="w-[70%]" />
                                        <span className="text-xs font-medium text-muted-foreground">{progress.toFixed(0)}%</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {item.targetDate ? <Badge variant="outline">{format(new Date(item.targetDate), 'PPP')}</Badge> : <Badge variant="outline">No Target Date</Badge>}
                                </TableCell>
                                <TableCell className="text-right">{item.targetDate ? formatCurrency(monthlyContribution) : '-'}</TableCell>
                                <TableCell className="text-right font-semibold">{formatCurrency(remainingAmount)}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
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
                                                This action cannot be undone. This will permanently delete this savings goal.
                                            </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => deleteGoal(item.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
                                                Delete
                                            </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )
                    })
                ) : (
                    <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                        No savings goals created yet. Add one to get started!
                    </TableCell>
                    </TableRow>
                )}
            </TableBody>
          </Table>
      </div>
    </>
  );
}
