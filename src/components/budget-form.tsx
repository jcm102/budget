
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
import { useAccountDetails } from '@/hooks/use-transferees';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useGoals } from '@/hooks/use-goals';
import { useDebt } from '@/hooks/use-debt';
import * as GoalService from '@/services/goal-service';
import * as DebtService from '@/services/debt-service';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { Label } from './ui/label';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

const formSchema = z.object({
    description: z.string().min(2, 'Description must be at least 2 characters.'),
    category: z.string().min(1, 'Category is required.'),
    amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
    type: z.enum(['Income', 'Debt Payments', 'Transfers', 'Pre-Authorized Payments']),
    date: z.string().min(1, 'A date is required.'),
    frequency: z.enum(['One-Time', 'Weekly', 'Bi-Weekly', 'Monthly', 'Monthly (Last Day)']),
    transferTo: z.string().optional(),
    transferFrom: z.string().optional(),
    // New fields for allocation
    allocationType: z.enum(['none', 'goal', 'debt']).default('none'),
    allocationTargetId: z.string().optional(),
    allocationAmount: z.coerce.number().optional(),
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
  const { accounts: transferees } = useAccountDetails();
  const { goals, fetchGoals } = useGoals();
  const { debts, fetchDebts } = useDebt();
  const [split, setSplit] = useState({ savings: 0, charity: 0, fun: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
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
      allocationType: 'none',
      allocationTargetId: '',
      allocationAmount: 0,
    },
  });

  const itemType = form.watch('type');
  const category = form.watch('category');
  const amount = form.watch('amount');
  const allocationType = form.watch('allocationType');

  const showCalculator = itemType === 'Income' && category === 'Misc. Income';

  useEffect(() => {
    if (showCalculator) {
      const splitAmount = parseFloat((amount / 3).toFixed(2));
      setSplit({
        savings: splitAmount,
        charity: splitAmount,
        fun: splitAmount,
      });
      // Automatically set the allocation amount to the full savings portion
      form.setValue('allocationAmount', splitAmount);
    } else {
        // Reset allocation when calculator is not shown
        form.setValue('allocationType', 'none');
        form.setValue('allocationTargetId', '');
        form.setValue('allocationAmount', 0);
    }
  }, [amount, showCalculator, form]);


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
          allocationType: 'none',
          allocationTargetId: '',
          allocationAmount: 0,
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
          allocationType: 'none',
          allocationTargetId: '',
          allocationAmount: 0,
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
    setIsSubmitting(true);
    const [year, month, day] = values.date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);

    const submissionData = {
      ...values,
      date: toLocalISOString(localDate),
      type: values.type as BudgetItemType,
      frequency: values.frequency as BudgetItemFrequency,
    };
    
    // Handle allocation logic
    if (showCalculator && values.allocationType !== 'none' && values.allocationTargetId && values.allocationAmount && values.allocationAmount > 0) {
        try {
            const { allocationType, allocationTargetId, allocationAmount } = values;
            if (allocationType === 'goal') {
                const goalToUpdate = goals.find(g => g.id === allocationTargetId);
                if (goalToUpdate) {
                    await GoalService.addToGoal(allocationTargetId, allocationAmount);
                    toast({
                        title: 'Goal Updated!',
                        description: `${formatCurrency(allocationAmount)} was added to "${goalToUpdate.name}".`
                    });
                    await fetchGoals();
                }
            } else if (allocationType === 'debt') {
                const debtToUpdate = debts.find(d => d.id === allocationTargetId);
                 if (debtToUpdate) {
                    await DebtService.addExtraPayment(allocationTargetId, allocationAmount);
                    toast({
                        title: 'Debt Updated!',
                        description: `An extra payment of ${formatCurrency(allocationAmount)} was made to "${debtToUpdate.name}".`
                    });
                    await fetchDebts();
                 }
            }
        } catch (error) {
             console.error("Failed to allocate funds:", error);
             toast({
                title: 'Allocation Error',
                description: 'Could not allocate the funds as requested.',
                variant: 'destructive',
            });
        }
    }


    if (editingItem) {
      updateBudgetItem(editingItem.id, submissionData);
    } else {
      addBudgetItem(submissionData);
    }
    
    setIsSubmitting(false);
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
                        <CardTitle className="text-base">Found Money: Split & Allocate</CardTitle>
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
                        <div className="space-y-3">
                             <Label>Allocate Savings/Debt Portion ({formatCurrency(split.savings)})</Label>
                             <FormField
                                control={form.control}
                                name="allocationType"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormControl>
                                        <RadioGroup
                                        onValueChange={field.onChange}
                                        value={field.value}
                                        className="flex gap-4"
                                        >
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="goal" /></FormControl>
                                                <FormLabel className="font-normal">Goal</FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-2 space-y-0">
                                                <FormControl><RadioGroupItem value="debt" /></FormControl>
                                                <FormLabel className="font-normal">Debt</FormLabel>
                                            </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    </FormItem>
                                )}
                             />

                             {allocationType !== 'none' && (
                                <div className="flex gap-2">
                                     <FormField
                                        control={form.control}
                                        name="allocationTargetId"
                                        render={({ field }) => (
                                            <FormItem className="flex-grow">
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder={`Select ${allocationType}`} />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {allocationType === 'goal' && goals.map(goal => (
                                                            <SelectItem key={goal.id} value={goal.id}>{goal.name}</SelectItem>
                                                        ))}
                                                         {allocationType === 'debt' && debts.map(debt => (
                                                            <SelectItem key={debt.id} value={debt.id}>{debt.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                    />
                                     <FormField
                                        control={form.control}
                                        name="allocationAmount"
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
                             )}
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
                      <SelectItem value="Monthly (Last Day)">Monthly (Last Day)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? 'Save Changes' : 'Add Item'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
