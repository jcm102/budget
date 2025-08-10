
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

const formSchema = z.object({
  name: z.string().min(2, 'Goal name must be at least 2 characters.'),
  targetAmount: z.coerce.number().min(0, 'Target amount must be a positive number.'),
  currentAmount: z.coerce.number().min(0, 'Current amount must be a positive number.'),
  targetDate: z.string().optional(),
});

type GoalFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addGoal: (item: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, item: Omit<Goal, 'id'>) => void;
  editingItem: Goal | null;
};

export function GoalForm({ open, onOpenChange, addGoal, updateGoal, editingItem }: GoalFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      targetAmount: 0,
      currentAmount: 0,
      targetDate: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          name: editingItem.name,
          targetAmount: editingItem.targetAmount,
          currentAmount: editingItem.currentAmount,
          targetDate: editingItem.targetDate ? new Date(editingItem.targetDate).toISOString().split('T')[0] : '',
        });
      } else {
        form.reset({
          name: '',
          targetAmount: 0,
          currentAmount: 0,
          targetDate: '',
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
        targetDate: localDateString
    };
    if (editingItem) {
      updateGoal(editingItem.id, submissionData);
    } else {
      addGoal(submissionData);
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
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Goal Name</FormLabel>
                  <FormControl><Input placeholder="e.g., New Car" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField control={form.control} name="targetAmount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Amount</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="currentAmount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Amount Saved</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
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
            <DialogFooter>
              <Button type="submit">{editingItem ? 'Save Changes' : 'Add Goal'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
