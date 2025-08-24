
'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { differenceInMonths } from 'date-fns';
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
import type { SavingsItem } from '@/types';

const formSchema = z.object({
  name: z.string().min(2, 'Fund name must be at least 2 characters.'),
  amount: z.coerce.number().min(0, 'Amount must be a positive number.'),
  goal: z.coerce.number().optional(), // Monthly contribution goal
  totalCost: z.coerce.number().optional(),
  savingsTarget: z.coerce.number().optional(),
  dueDate: z.string().optional(),
});

type SavingsFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addSavingsItem: (item: Omit<SavingsItem, 'id'>) => void;
  updateSavingsItem: (id: string, item: Partial<Omit<SavingsItem, 'id'>>) => void;
  editingItem: SavingsItem | null;
};

export function SavingsForm({ open, onOpenChange, addSavingsItem, updateSavingsItem, editingItem }: SavingsFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      amount: 0,
      goal: 0,
      totalCost: 0,
      savingsTarget: 0,
      dueDate: '',
    },
  });
  
  const totalCost = form.watch('totalCost');
  const savingsTarget = form.watch('savingsTarget');
  const dueDate = form.watch('dueDate');
  const amountSaved = form.watch('amount');

  useEffect(() => {
    const costToUse = (savingsTarget && savingsTarget > 0) ? savingsTarget : (totalCost || 0);

    if (costToUse > 0 && dueDate) {
      const today = new Date();
      const due = new Date(dueDate);
      
      if (due > today) {
        const monthsRemaining = differenceInMonths(due, today);
        const planningMonths = monthsRemaining > 0 ? monthsRemaining : 1;
        const remainingAmount = costToUse - amountSaved;
        
        if (remainingAmount > 0) {
          const monthlyGoal = remainingAmount / planningMonths;
          form.setValue('goal', parseFloat(monthlyGoal.toFixed(2)));
        } else {
          form.setValue('goal', 0);
        }
      }
    }
  }, [totalCost, savingsTarget, dueDate, amountSaved, form]);

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          name: editingItem.name,
          amount: editingItem.amount,
          goal: editingItem.goal || 0,
          totalCost: editingItem.totalCost || 0,
          savingsTarget: editingItem.savingsTarget || 0,
          dueDate: editingItem.dueDate ? new Date(editingItem.dueDate).toISOString().split('T')[0] : '',
        });
      } else {
        form.reset({
          name: '',
          amount: 0,
          goal: 0,
          totalCost: 0,
          savingsTarget: 0,
          dueDate: '',
        });
      }
    }
  }, [editingItem, open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
     const submissionData = {
      ...values,
      dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : undefined,
    };
    if (editingItem) {
      updateSavingsItem(editingItem.id, submissionData);
    } else {
      addSavingsItem(submissionData);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Sinking Fund' : 'Add New Sinking Fund'}</DialogTitle>
          <DialogDescription>
            {editingItem ? 'Update the details for your fund.' : 'Create a new fund category for your account. To link to a Goal, Subscription, or Auto-Shipment, ensure the name is an exact match.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fund Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Car Maintenance" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Amount Saved</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField control={form.control} name="totalCost" render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Cost (Optional)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="savingsTarget" render={({ field }) => (
                <FormItem>
                  <FormLabel>My Savings Target (Optional)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField control={form.control} name="dueDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date (Optional)</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="goal" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Contribution Goal (Optional)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                   <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">{editingItem ? 'Save Changes' : 'Add Fund'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
