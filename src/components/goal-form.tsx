
'use client';

import { useEffect } from 'react';
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
import type { Goal } from '@/types';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

const formSchema = z.object({
  name: z.string().min(2, 'Goal name must be at least 2 characters.'),
  goalType: z.enum(['fixed', 'monthly']),
  targetAmount: z.coerce.number().optional(),
  currentAmount: z.coerce.number().min(0, 'Current amount must be a positive number.'),
  monthlyContribution: z.coerce.number().optional(),
  targetDate: z.string().optional(),
  url: z.string().url().optional().or(z.literal('')),
}).refine(data => {
  if (data.goalType === 'fixed') {
    return data.targetAmount !== undefined && data.targetAmount > 0;
  }
  return true;
}, {
  message: 'Target amount is required for fixed goals.',
  path: ['targetAmount'],
}).refine(data => {
  if (data.goalType === 'monthly') {
    return data.monthlyContribution !== undefined && data.monthlyContribution > 0;
  }
  return true;
}, {
  message: 'Monthly contribution is required for monthly goals.',
  path: ['monthlyContribution'],
});


type GoalFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addGoal: (item: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, item: Partial<Omit<Goal, 'id'>>) => void;
  editingItem: Goal | null;
};

export function GoalForm({ open, onOpenChange, addGoal, updateGoal, editingItem }: GoalFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      goalType: 'fixed',
      targetAmount: 0,
      currentAmount: 0,
      monthlyContribution: 0,
      targetDate: '',
      url: '',
    },
  });

  const goalType = form.watch('goalType');

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          name: editingItem.name,
          goalType: editingItem.goalType || 'fixed',
          targetAmount: editingItem.targetAmount,
          currentAmount: editingItem.currentAmount,
          monthlyContribution: editingItem.monthlyContribution || 0,
          targetDate: editingItem.targetDate ? new Date(editingItem.targetDate).toISOString().split('T')[0] : '',
          url: editingItem.url || '',
        });
      } else {
        form.reset({
          name: '',
          goalType: 'fixed',
          targetAmount: 0,
          currentAmount: 0,
          monthlyContribution: 0,
          targetDate: '',
          url: '',
        });
      }
    }
  }, [editingItem, open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    let localDateString: string | null = null;
    if (values.targetDate) {
        const [year, month, day] = values.targetDate.split('-').map(Number);
        const localDate = new Date(year, month - 1, day);
        localDateString = localDate.toISOString();
    }
    
    const submissionData = { 
        ...values,
        targetAmount: values.goalType === 'monthly' ? 0 : values.targetAmount!,
        monthlyContribution: values.goalType === 'fixed' ? undefined : values.monthlyContribution,
        targetDate: values.goalType === 'monthly' ? null : localDateString,
        url: values.url || null,
    };

    if (editingItem) {
      updateGoal(editingItem.id, submissionData);
    } else {
      addGoal(submissionData as Omit<Goal, 'id'>);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Savings Goal' : 'Add New Savings Goal'}</DialogTitle>
          <DialogDescription>
            {editingItem ? 'Update the details for your goal.' : 'Fill in the details for your new savings goal.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="goalType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value="fixed" /></FormControl>
                        <FormLabel className="font-normal">Fixed Target</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value="monthly" /></FormControl>
                        <FormLabel className="font-normal">Monthly Savings</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal Name</FormLabel>
                  <FormControl><Input placeholder="e.g., New Car" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {goalType === 'fixed' && (
              <>
                <FormField control={form.control} name="targetAmount" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Target Amount</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField control={form.control} name="targetDate" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Target Date (Optional)</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
              </>
            )}

            {goalType === 'monthly' && (
               <FormField control={form.control} name="monthlyContribution" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Contribution</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''}/></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField control={form.control} name="currentAmount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Amount Saved</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField control={form.control} name="url" render={({ field }) => (
                <FormItem>
                  <FormLabel>URL (Optional)</FormLabel>
                  <FormControl><Input type="url" placeholder="https://example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit">{editingItem ? 'Save Changes' : 'Add Goal'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
