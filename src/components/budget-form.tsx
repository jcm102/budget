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
import type { BudgetItem, BudgetItemType, BudgetItemFrequency } from '@/types';
import { useCategories } from '@/hooks/use-categories';
import { useTransferees } from '@/hooks/use-transferees';

const formSchema = z.object({
    description: z.string().min(2, 'Description must be at least 2 characters.'),
    category: z.string().min(1, 'Category is required.'),
    amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
    type: z.enum(['Income', 'Debt Payments', 'Transfers', 'Pre-Authorized Payments']),
    date: z.string().min(1, 'A date is required.'),
    frequency: z.enum(['One-Time', 'Weekly', 'Bi-Weekly', 'Monthly']),
    transferTo: z.string().optional(),
    transferFrom: z.string().optional(),
  }).refine(data => {
    if (data.type === 'Transfers') {
      return !!data.transferTo && !!data.transferFrom;
    }
    return true;
  }, {
    message: 'Both "Transfer From" and "Transfer To" are required for transfers.',
    path: ['transferTo'], // You can associate the error with a specific field
  });

type BudgetFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addBudgetItem: (item: Omit<BudgetItem, 'id'>) => void;
  updateBudgetItem: (id: string, item: Omit<BudgetItem, 'id'>) => void;
  editingItem: BudgetItem | null;
};

export function BudgetForm({ open, onOpenChange, addBudgetItem, updateBudgetItem, editingItem }: BudgetFormProps) {
  const { categories: incomeCategories } = useCategories();
  const { transferees } = useTransferees();
  
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
    },
  });

  const itemType = form.watch('type');

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
        });
      }
    }
  }, [editingItem, open, form]);

  useEffect(() => {
    if (itemType !== 'Income') {
        form.setValue('category', 'N/A');
    } else {
        form.setValue('category', '');
    }
     if (itemType !== 'Transfers') {
      form.setValue('transferFrom', undefined);
      form.setValue('transferTo', undefined);
    }
  }, [itemType, form]);


  function onSubmit(values: z.infer<typeof formSchema>) {
    // This logic ensures the date is treated in the user's local timezone, not UTC.
    const [year, month, day] = values.date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);

    const submissionData = {
      ...values,
      date: toLocalISOString(localDate), // Store as ISO string with timezone offset
      type: values.type as BudgetItemType,
      frequency: values.frequency as BudgetItemFrequency,
    };
    if (editingItem) {
      updateBudgetItem(editingItem.id, submissionData);
    } else {
      addBudgetItem(submissionData);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
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
             {itemType === 'Income' ? (
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
             ) : (
                // Hidden or non-existent for other types
                <></>
             )}
            <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {itemType === 'Transfers' && (
              <>
                <FormField control={form.control} name="transferFrom" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transfer From</FormLabel>
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
                      <FormLabel>Transfer To</FormLabel>
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
              <Button type="submit">{editingItem ? 'Save Changes' : 'Add Item'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
