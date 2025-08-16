
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
import { Checkbox } from './ui/checkbox';
import { useSavings } from '@/hooks/use-savings';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  name: z.string().min(2, 'Goal name must be at least 2 characters.'),
  cost: z.coerce.number().min(0.01, 'Cost must be a positive number.'),
  link: z.string().url('Please enter a valid URL.').or(z.literal('')).optional(),
  createSinkingFund: z.boolean().default(false),
});


type GoalFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addGoal: (item: Omit<Goal, 'id'>, createSinkingFund: boolean) => void;
  updateGoal: (id: string, item: Partial<Omit<Goal, 'id'>>) => void;
  editingItem: Goal | null;
};

export function GoalForm({ open, onOpenChange, addGoal, updateGoal, editingItem }: GoalFormProps) {
  const { savingsItems, addSavingsItem } = useSavings();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      cost: 0,
      link: '',
      createSinkingFund: false,
    },
  });

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          name: editingItem.name,
          cost: editingItem.cost || 0,
          link: editingItem.link || '',
          createSinkingFund: false,
        });
      } else {
        form.reset({
          name: '',
          cost: 0,
          link: '',
          createSinkingFund: false,
        });
      }
    }
  }, [editingItem, open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const submissionData = { 
        name: values.name,
        cost: values.cost,
        link: values.link || null,
        // Amount is no longer part of the goal itself
    };

    if (editingItem) {
      updateGoal(editingItem.id, submissionData);
       if (values.createSinkingFund) {
        const fundExists = savingsItems.some(item => item.name.toLowerCase() === values.name.toLowerCase());
        if (!fundExists) {
            addSavingsItem({ name: values.name, amount: 0, goal: values.cost });
            toast({ title: 'Sinking Fund Created', description: `A sinking fund for "${values.name}" has been created.` });
        } else {
            toast({ title: 'Sinking Fund Exists', description: `A sinking fund for "${values.name}" already exists.`, variant: 'destructive' });
        }
      }
    } else {
      addGoal(submissionData as Omit<Goal, 'id'>, values.createSinkingFund);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Goal' : 'Add New Goal'}</DialogTitle>
          <DialogDescription>
            {editingItem ? 'Update the details for this savings goal.' : 'Designate a portion of your future spending money for a specific goal.'}
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
            
            <FormField control={form.control} name="cost" render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Cost</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField control={form.control} name="link" render={({ field }) => (
                <FormItem>
                  <FormLabel>Link (Optional)</FormLabel>
                  <FormControl><Input placeholder="https://example.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="createSinkingFund"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Create a Sinking Fund for this goal
                    </FormLabel>
                    <FormMessage />
                  </div>
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
