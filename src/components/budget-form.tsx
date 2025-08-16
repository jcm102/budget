
'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { BudgetItem, BudgetItemType, BudgetItemFrequency } from '@/types';
import { useIncomeCategories } from '@/hooks/use-income-categories';
import { useTransferees } from '@/hooks/use-transferees';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useGoals } from '@/hooks/use-goals';
import * as GoalService from '@/services/goal-service';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Label } from './ui/label';

const formSchema = z.object({
    description: z.string().min(2, 'Description must be at least 2 characters.'),
    category: z.string().min(1, 'Category is required.'),
    amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
    type: z.enum(['Income', 'Debt Payments', 'Transfers', 'Pre-Authorized Payments']),
    date: z.string().min(1, 'A date is required.'),
    frequency: z.enum(['One-Time', 'Weekly', 'Bi-Weekly', 'Monthly']),
    transferTo: z.string().optional(),
    transferFrom: z.string().optional(),
    goalAllocation: z.object({
        goalId: z.string(),
        amount: z.coerce.number(),
    }).optional(),
  }).refine(data => {
    if (data.type === 'Transfers') {
      return !!data.transferTo && !!data.transferFrom;
    }
    return true;
  }, {
    message: 'Both "Source" and "Destination" accounts are required for transfers.',
    path: ['transferTo'],
  });

type BudgetFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addBudgetItem: (item: Omit<BudgetItem, 'id'>) => void;
  updateBudgetItem: (id: string, item: Omit<BudgetItem, 'id'>) => void;
  editingItem: BudgetItem | null;
};

export function BudgetForm({ open, onOpenChange, addBudgetItem, updateBudgetItem, editingItem }: BudgetFormProps) {
  const { categories: incomeCategories } = useIncomeCategories();
  const { transferees } = useTransferees();
  const { goals, fetchGoals } = useGoals();
  const [split, setSplit] = useState({ savings: 0, charity: 0, fun: 0 });
  const [isSubmittingGoal, setIsSubmittingGoal] = useState(false);
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      category: '',
      amount: 0,
      type: 'Income',
      date: new Date().toISOString().split('T')[0],
      frequency: 'One-Time',
      transferFrom: '',
      transferTo: '',
      goalAllocation: undefined,
    },
  });

  const itemType = form.watch('type');
  const category = form.watch('category');
  const amount = form.watch('amount');

  const showCalculator = itemType === 'Income' && category === 'Misc. Income';

  useEffect(() => {
    if (showCalculator) {
      const splitAmount = amount / 3;
      setSplit({
        savings: splitAmount,
        charity: splitAmount,
        fun: splitAmount,
      });
    }
  }, [amount, showCalculator]);


  const toLocalISOString = (date: Date) => {
    const tzOffset = -date.getTimezoneOffset();
    const diff = tzOffset >= 0 ? '+' : '-';
    const pad = (n: number) => `${Math.floor(Math.abs(n))}`.padStart(2, '0');
    return date.getFullYear() +
      '-' + pad(date.getMonth() + 1) +
      '-' + pad(date.getDate()) +
      'T' + pad(date.getHours()) +
      ':' + pad(date.getMinutes()) +
      ':' + pad(date.getSeconds()) +
      diff + pad(tzOffset / 60) +
      ':' + pad(tzOffset % 60);
  };
  
  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          description: editingItem.description,
          category: editingItem.category,
          amount: editingItem.amount,
          type: editingItem.type,
          date: new Date(editingItem.date).toISOString().split('T')[0],
          frequency: editingItem.frequency || 'One-Time',
          transferFrom: editingItem.transferFrom || '',
          transferTo: editingItem.transferTo || '',
          goalAllocation: undefined,
        });
      } else {
        form.reset({
          description: '',
          category: '',
          amount: 0,
          type: 'Income',
          date: new Date().toISOString().split('T')[0],
          frequency: 'One-Time',
          transferFrom: '',
          transferTo: '',
          goalAllocation: undefined,
        });
      }
    }
  }, [editingItem, open, form]);

  useEffect(() => {
    if (itemType !== 'Income') {
        form.setValue('category', 'N/A');
    } else {
        if(form.getValues('category') === 'N/A'){
             form.setValue('category', '');
        }
    }
     if (itemType !== 'Transfers') {
      form.setValue('transferFrom', undefined);
      form.setValue('transferTo', undefined);
    }
  }, [itemType, form]);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    const [year, month, day] = values.date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);

    const submissionData = {
      ...values,
      date: toLocalISOString(localDate),
      type: values.type as BudgetItemType,
      frequency: values.frequency as BudgetItemFrequency,
    };
    
    // Handle goal allocation
    if (showCalculator && values.goalAllocation && values.goalAllocation.goalId && values.goalAllocation.amount > 0) {
        setIsSubmittingGoal(true);
        try {
            const { goalId, amount: allocationAmount } = values.goalAllocation;
            const goalToUpdate = goals.find(g => g.id === goalId);
            if (goalToUpdate) {
                const newAmount = goalToUpdate.amount + allocationAmount;
                await GoalService.updateGoal(goalId, { amount: newAmount });
                toast({
                    title: 'Goal Updated!',
                    description: `${formatCurrency(allocationAmount)} was added to "${goalToUpdate.name}".`
                });
                await fetchGoals();
            }
        } catch (error) {
             console.error("Failed to update goal:", error);
             toast({
                title: 'Error',
                description: 'Could not update the savings goal.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmittingGoal(false);
        }
    }


    if (editingItem) {
      updateBudgetItem(editingItem.id, submissionData);
    } else {
      addBudgetItem(submissionData);
    }
    onOpenChange(false);
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          <DialogDescription>
            {editingItem ? 'Update the details for your budget item.' : 'Fill in the details for your new budget item.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select item type" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Income">Income</SelectItem>
                      <SelectItem value="Debt Payments">Debt Payments</SelectItem>
                      <SelectItem value="Transfers">Transfers</SelectItem>
                      <SelectItem value="Pre-Authorized Payments">Pre-Authorized Payments</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input placeholder="e.g., Monthly Salary" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             {itemType === 'Income' && (
                <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {incomeCategories.map(category => (
                            <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
             )}
            <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showCalculator && (
                 <Card className="bg-secondary/50">
                    <CardHeader className="p-4">
                        <CardTitle className="text-base">Split & Allocate</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 text-sm space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Charity:</span>
                                <span className="font-medium">{formatCurrency(split.charity)}</span>
                            </div>
                             <div className="flex justify-between">
                                <span className="text-muted-foreground">Fun:</span>
                                <span className="font-medium">{formatCurrency(split.fun)}</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Allocate Savings/Debt Portion</Label>
                            <div className="flex gap-2">
                                <FormField
                                    control={form.control}
                                    name="goalAllocation.goalId"
                                    render={({ field }) => (
                                        <FormItem className="flex-grow">
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select Goal" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {goals.map(goal => (
                                                        <SelectItem key={goal.id} value={goal.id}>{goal.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )}
                                />
                                 <FormField
                                    control={form.control}
                                    name="goalAllocation.amount"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <Input 
                                                    type="number" 
                                                    step="0.01" 
                                                    {...field} 
                                                    className="w-28" 
                                                    placeholder="Amount"
                                                    onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                                />
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <Button type="button" size="sm" variant="ghost" className="w-full" onClick={() => form.setValue('goalAllocation.amount', split.savings)}>
                                Allocate Full Amount ({formatCurrency(split.savings)})
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}


            {itemType === 'Transfers' && (
              <>
                <FormField control={form.control} name="transferFrom" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Account</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a source" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {transferees.map(t => (
                            <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                       <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="transferTo" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Destination Account</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select a destination" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            {transferees.map(t => (
                            <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                            ))}
                        </SelectContent>
                        </Select>
                       <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="frequency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="One-Time">One-Time</SelectItem>
                      <SelectItem value="Weekly">Weekly</SelectItem>
                      <SelectItem value="Bi-Weekly">Bi-Weekly</SelectItem>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isSubmittingGoal}>
                {isSubmittingGoal && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? 'Save Changes' : 'Add Item'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
