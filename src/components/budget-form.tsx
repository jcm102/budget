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
import type { BudgetItem, BudgetItemType, Account, IncomeSource } from '@/types';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  amount: z.coerce.number().min(0, 'Amount must be a positive number.'),
  type: z.enum(['income', 'savings', 'debt', 'transfer']),
  destination: z.enum(['Checking', 'Savings', 'Credit Card', 'Investment', 'Other']).optional().nullable(),
});

type BudgetFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addBudgetItem: (item: Omit<BudgetItem, 'id'>) => void;
  updateBudgetItem: (id: string, item: Omit<BudgetItem, 'id'>) => void;
  editingItem: BudgetItem | null;
};

const itemTypes: BudgetItemType[] = ['income', 'savings', 'debt', 'transfer'];
const accounts: Account[] = ['Checking', 'Savings', 'Credit Card', 'Investment', 'Other'];
const incomeSources: IncomeSource[] = ['Paycheck', 'Bonus', 'Other'];


export function BudgetForm({ open, onOpenChange, addBudgetItem, updateBudgetItem, editingItem }: BudgetFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      amount: 0,
      type: 'transfer',
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
          destination: editingItem.destination,
        });
      } else {
        form.reset({
          name: '',
          amount: 0,
          type: 'transfer',
          destination: null,
        });
      }
    }
  }, [editingItem, open, form]);

  useEffect(() => {
    if (itemType !== 'transfer') {
      form.setValue('destination', null);
    }
    if (itemType === 'income') {
      // No specific action needed here anymore for name, 
      // as it's handled by the conditional rendering below.
    } else {
      // If the type is NOT income, and the current name is one of the income sources, clear it.
      if (incomeSources.includes(form.getValues('name') as IncomeSource)) {
        form.setValue('name', '');
      }
    }
  }, [itemType, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const submissionData = {
        ...values,
        type: values.type as BudgetItemType,
        destination: values.type === 'transfer' ? values.destination : null,
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
             <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an item type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {itemTypes.map(type => (
                        <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {itemType === 'income' ? (
                 <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Income Source</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select an income source" />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {incomeSources.map(source => (
                                <SelectItem key={source} value={source}>{source}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            ) : (
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                        <Input placeholder="e.g., Groceries, Rent" {...field} />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
            )}

            <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {itemType === 'transfer' && (
               <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || ''} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a destination account" />
                        </Trigger>
                      </FormControl>
                      <SelectContent>
                        {accounts.map(account => (
                          <SelectItem key={account} value={account}>{account}</SelectItem>
                        ))}
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
