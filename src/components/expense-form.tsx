
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { Expense } from '@/types';
import { useCategories } from '@/hooks/use-categories';
import { useTransferees } from '@/hooks/use-transferees';

const formSchema = z.object({
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
  category: z.string().min(1, 'Category is required.'),
  transferee: z.string().min(1, 'Payment source is required.'),
  date: z.string().min(1, 'A date is required.'),
  reimbursable: z.boolean(),
});

type ExpenseFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addExpense: (item: Omit<Expense, 'id'>) => void;
  updateExpense: (id: string, item: Omit<Expense, 'id'>) => void;
  editingItem: Expense | null;
};

export function ExpenseForm({ open, onOpenChange, addExpense, updateExpense, editingItem }: ExpenseFormProps) {
  const { categories } = useCategories();
  const { transferees } = useTransferees();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      amount: 0,
      category: '',
      transferee: '',
      date: new Date().toISOString().split('T')[0],
      reimbursable: false,
    },
  });

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          description: editingItem.description,
          amount: editingItem.amount,
          category: editingItem.category,
          transferee: editingItem.transferee,
          date: new Date(editingItem.date).toISOString().split('T')[0],
          reimbursable: editingItem.reimbursable,
        });
      } else {
        form.reset({
          description: '',
          amount: 0,
          category: '',
          transferee: '',
          date: new Date().toISOString().split('T')[0],
          reimbursable: false,
        });
      }
    }
  }, [editingItem, open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const [year, month, day] = values.date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    
    const submissionData = {
      ...values,
      date: localDate.toISOString(),
    };
    if (editingItem) {
      updateExpense(editingItem.id, submissionData);
    } else {
      addExpense(submissionData);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Work Expense' : 'Add New Work Expense'}</DialogTitle>
          <DialogDescription>
            {editingItem ? 'Update the details for your work expense.' : 'Fill in the details for your new work expense.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input placeholder="e.g., Groceries" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="category" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                        {categories.map(category => (
                        <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="transferee" render={({ field }) => (
                <FormItem>
                  <FormLabel>Paid From</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select a payment source" /></SelectTrigger>
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
            <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="reimbursable"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Reimbursable</FormLabel>
                    <FormMessage />
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">{editingItem ? 'Save Changes' : 'Add Expense'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
