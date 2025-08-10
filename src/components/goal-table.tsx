
'use client';

import { useState } from 'react';
import { format, differenceInCalendarMonths, startOfDay } from 'date-fns';
import { Pencil, Trash2, PlusCircle, DollarSign, Calendar, Target, Repeat } from 'lucide-react';
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

export function GoalTable() {
  const { goals, addGoal, updateGoal, deleteGoal, isLoading } = useGoals();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Goal | null>(null);

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
              <TableRow>
                <TableHead>Goal</TableHead>
                <TableHead className="w-[200px]">Progress</TableHead>
                <TableHead>Target/Frequency</TableHead>
                <TableHead className="text-right">Monthly Contribution</TableHead>
                <TableHead className="text-right">Remaining/Saved</TableHead>
                <TableHead className="w-[100px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    renderLoadingSkeleton()
                ) : goals.length > 0 ? (
                    goals.map((item) => {
                        if (item.goalType === 'monthly') {
                            return (
                                <TableRow key={item.id}>
                                    <TableCell className="font-medium">{item.name}</TableCell>
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
                                    <div>{item.name}</div>
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
