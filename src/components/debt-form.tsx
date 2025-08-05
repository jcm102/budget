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
import type { Debt } from '@/types';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  balance: z.coerce.number().min(0, 'Balance must be a positive number.'),
  minimumPayment: z.coerce.number().min(0, 'Minimum payment must be a positive number.'),
  actualPayment: z.coerce.number().min(0, 'Actual payment must be a positive number.'),
  dueDate: z.string().min(1, 'A due date is required.'),
});

type DebtFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addDebt: (debt: Omit<Debt, 'id' | 'order'>) => void;
  updateDebt: (id: string, debt: Omit<Debt, 'id' | 'order'>) => void;
  editingDebt: Debt | null;
};

// This function ensures the date from a YYYY-MM-DD string is treated as local timezone, not UTC.
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

export function DebtForm({ open, onOpenChange, addDebt, updateDebt, editingDebt }: DebtFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      balance: 0,
      minimumPayment: 0,
      actualPayment: 0,
      dueDate: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (editingDebt) {
        form.reset({
          name: editingDebt.name,
          balance: editingDebt.balance,
          minimumPayment: editingDebt.minimumPayment,
          actualPayment: editingDebt.actualPayment,
          dueDate: new Date(editingDebt.dueDate).toISOString().split('T')[0],
        });
      } else {
        form.reset({
          name: '',
          balance: 0,
          minimumPayment: 0,
          actualPayment: 0,
          dueDate: new Date().toISOString().split('T')[0],
        });
      }
    }
  }, [editingDebt, open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const [year, month, day] = values.dueDate.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    
    const submissionData = { ...values, dueDate: toLocalISOString(localDate) };
    if (editingDebt) {
      updateDebt(editingDebt.id, submissionData);
    } else {
      addDebt(submissionData);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingDebt ? 'Edit Debt' : 'Add New Debt'}</DialogTitle>
          <DialogDescription>
            {editingDebt ? 'Update the details for your debt.' : 'Fill in the details for your new debt entry.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Debt Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Credit Card" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="balance" render={({ field }) => (
                <FormItem>
                  <FormLabel>Balance</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="minimumPayment" render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum Payment</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="actualPayment" render={({ field }) => (
                <FormItem>
                  <FormLabel>Actual Payment</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="dueDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                   <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">{editingDebt ? 'Save Changes' : 'Add Debt'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
