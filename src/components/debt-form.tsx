
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Debt, DebtType } from '@/types';
import { Separator } from './ui/separator';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  interestRate: z.coerce.number().min(0, 'Interest rate must be a positive number.'),
  debtType: z.enum(['Credit Card', 'Loan', 'Line of Credit']).optional(),
  // Current month fields
  balance: z.coerce.number().min(0, 'Balance must be a positive number.'),
  minimumPayment: z.coerce.number().min(0, 'Minimum payment must be a positive number.'),
  actualPayment: z.coerce.number().min(0, 'Actual payment must be a positive number.'),
  dueDate: z.string().min(1, 'A due date is required.'),
  // Next month fields
  nextBalance: z.coerce.number().optional(),
  nextMinimumPayment: z.coerce.number().optional(),
  nextDueDate: z.string().optional(),
});

type DebtFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addDebt: (debt: Omit<Debt, 'id' | 'order'>) => void;
  updateDebt: (id: string, debt: Partial<Omit<Debt, 'id' | 'order'>>) => void;
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
      interestRate: 0,
      debtType: 'Credit Card',
      balance: 0,
      minimumPayment: 0,
      actualPayment: 0,
      dueDate: '',
      nextBalance: 0,
      nextMinimumPayment: 0,
      nextDueDate: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (editingDebt) {
        form.reset({
          name: editingDebt.name,
          interestRate: editingDebt.interestRate || 0,
          debtType: editingDebt.debtType || 'Credit Card',
          balance: editingDebt.balance,
          minimumPayment: editingDebt.minimumPayment,
          actualPayment: editingDebt.actualPayment,
          dueDate: new Date(editingDebt.dueDate).toISOString().split('T')[0],
          nextBalance: editingDebt.nextBalance || 0,
          nextMinimumPayment: editingDebt.nextMinimumPayment || 0,
          nextDueDate: editingDebt.nextDueDate ? new Date(editingDebt.nextDueDate).toISOString().split('T')[0] : '',
        });
      } else {
        const today = new Date().toISOString().split('T')[0];
        form.reset({
          name: '',
          interestRate: 0,
          debtType: 'Credit Card',
          balance: 0,
          minimumPayment: 0,
          actualPayment: 0,
          dueDate: today,
          nextBalance: 0,
          nextMinimumPayment: 0,
          nextDueDate: today,
        });
      }
    }
  }, [editingDebt, open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const [year, month, day] = values.dueDate.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    
    let nextLocalDate: string | undefined = undefined;
    if (values.nextDueDate) {
        const [nextYear, nextMonth, nextDay] = values.nextDueDate.split('-').map(Number);
        nextLocalDate = toLocalISOString(new Date(nextYear, nextMonth - 1, nextDay));
    }

    const submissionData = { 
        ...values, 
        dueDate: toLocalISOString(localDate),
        nextDueDate: nextLocalDate,
        debtType: values.debtType as DebtType,
    };

    if (editingDebt) {
      updateDebt(editingDebt.id, submissionData);
    } else {
      addDebt(submissionData as Omit<Debt, 'id' | 'order'>);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingDebt ? 'Edit Debt' : 'Add New Debt'}</DialogTitle>
          <DialogDescription>
            {editingDebt ? 'Update the details for your debt.' : 'Fill in the details for your new debt entry.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
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
              <FormField control={form.control} name="debtType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Debt Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                        <FormControl>
                           <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="Credit Card">Credit Card</SelectItem>
                            <SelectItem value="Loan">Loan</SelectItem>
                            <SelectItem value="Line of Credit">Line of Credit</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField control={form.control} name="interestRate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Interest Rate (%)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />
            <h4 className="text-md font-medium text-center">Current Month</h4>
            <Separator />

            <FormField control={form.control} name="balance" render={({ field }) => (
                <FormItem>
                  <FormLabel>Balance</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="minimumPayment" render={({ field }) => (
                <FormItem>
                  <FormLabel>Minimum Payment</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="actualPayment" render={({ field }) => (
                <FormItem>
                  <FormLabel>Actual Payment</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
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
            
            <Separator />
            <h4 className="text-md font-medium text-center">Next Month</h4>
            <Separator />

             <FormField control={form.control} name="nextBalance" render={({ field }) => (
                <FormItem>
                  <FormLabel>Next Balance</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="nextMinimumPayment" render={({ field }) => (
                <FormItem>
                  <FormLabel>Next Minimum Payment</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="nextDueDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Next Due Date</FormLabel>
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
