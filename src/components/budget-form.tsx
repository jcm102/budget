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
import type { BudgetItem, BudgetItemType, TransferDestination } from '@/types';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  amount: z.coerce.number().min(0, 'Amount must be a positive number.'),
  type: z.enum(['income', 'debt', 'transfer'], {
    required_error: 'Please select a type.',
  }),
  category: z.string().optional().nullable(),
  destination: z.enum(['checking', 'savings', 'investment']).optional().nullable(),
}).refine(data => {
    if (data.type === 'transfer' && !data.destination) {
        return false;
    }
    return true;
}, {
    message: 'Destination is required for transfers.',
    path: ['destination'],
});

const incomeCategories = ['Paycheck', 'Bonus', 'Freelance', 'Other'];

type BudgetFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addBudgetItem: (item: Omit<BudgetItem, 'id'>) => void;
  updateBudgetItem: (id: string, item: Omit<BudgetItem, 'id'>) => void;
  editingItem: BudgetItem | null;
};

export function BudgetForm({ open, onOpenChange, addBudgetItem, updateBudgetItem, editingItem }: BudgetFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      amount: 0,
      type: 'income',
      category: null,
      destination: null,
    },
  });

  const itemType = form.watch('type');

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          name: editingItem.name,
          amount: editingItem.amount,
          type: editingItem.type,
          category: editingItem.category,
          destination: editingItem.destination,
        });
      } else {
        form.reset({
          name: '',
          amount: 0,
          type: 'income',
          category: 'Paycheck',
          destination: null,
        });
      }
    }
  }, [editingItem, open, form]);

  useEffect(() => {
    if (itemType !== 'transfer') {
      form.setValue('destination', null);
    }
    if (itemType !== 'income') {
        form.setValue('category', null);
    }
  }, [itemType, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const submissionData = {
        ...values,
        type: values.type as BudgetItemType,
        category: values.category,
        destination: values.destination as TransferDestination | null,
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
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Paycheck" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="income">Income</SelectItem>
                      <SelectItem value="debt">Debt Payment</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             {itemType === 'income' && (
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {incomeCategories.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
             {itemType === 'transfer' && (
              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a destination" />
                        </Trigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="checking">Checking</SelectItem>
                        <SelectItem value="savings">Savings Account</SelectItem>
                        <SelectItem value="investment">Investment Account</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <DialogFooter>
              <Button type="submit">{editingItem ? 'Save Changes' : 'Add Item'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
