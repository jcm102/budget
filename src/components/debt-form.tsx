'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Debt } from '@/types';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  balance: z.coerce.number().min(0, 'Balance must be a positive number.'),
  minimumPayment: z.coerce.number().min(0, 'Minimum payment must be a positive number.'),
  actualPayment: z.coerce.number().min(0, 'Actual payment must be a positive number.'),
  dueDate: z.date({ required_error: 'A due date is required.' }),
});

type DebtFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addDebt: (debt: Omit<Debt, 'id'>) => void;
  updateDebt: (id: string, debt: Omit<Debt, 'id'>) => void;
  editingDebt: Debt | null;
};

export function DebtForm({ open, onOpenChange, addDebt, updateDebt, editingDebt }: DebtFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      balance: 0,
      minimumPayment: 0,
      actualPayment: 0,
      dueDate: new Date(),
    },
  });

  useEffect(() => {
    if (editingDebt) {
      form.reset({
        ...editingDebt,
        dueDate: new Date(editingDebt.dueDate),
      });
    } else {
      form.reset({
        name: '',
        balance: 0,
        minimumPayment: 0,
        actualPayment: 0,
        dueDate: new Date(),
      });
    }
  }, [editingDebt, form, open]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const submissionData = { ...values, dueDate: values.dueDate.toISOString() };
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
                <FormItem className="flex flex-col">
                  <FormLabel>Due Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant={'outline'} className={cn('w-full pl-3 text-left font-normal', !field.value && 'text-muted-foreground')}>
                          {field.value ? format(field.value, 'PPP') : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                    </PopoverContent>
                  </Popover>
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
