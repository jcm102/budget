

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
import type { Goal } from '@/types';
import { useAccounts } from '@/hooks/use-accounts';


const formSchema = z.object({
  name: z.string().min(2, 'Goal name must be at least 2 characters.'),
  accountId: z.string().min(1, 'An account is required.'),
  cost: z.coerce.number().min(0.01, 'Cost must be a positive number.'),
  amount: z.coerce.number().min(0, 'Amount must be a positive number.'),
  link: z.string().url('Please enter a valid URL.').or(z.literal('')).optional(),
});


type GoalFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addGoal: (item: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, item: Partial<Omit<Goal, 'id'>>) => void;
  editingItem: Goal | null;
};

export function GoalForm({ open, onOpenChange, addGoal, updateGoal, editingItem }: GoalFormProps) {
  const { accounts, isLoading: isLoadingAccounts } = useAccounts();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      accountId: '',
      cost: 0,
      amount: 0,
      link: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          name: editingItem.name,
          accountId: editingItem.accountId,
          cost: editingItem.cost || 0,
          amount: editingItem.amount || 0,
          link: editingItem.link || '',
        });
      } else {
        form.reset({
          name: '',
          accountId: accounts[0]?.id || '',
          cost: 0,
          amount: 0,
          link: '',
        });
      }
    }
  }, [editingItem, open, form, accounts]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const submissionData = { 
        name: values.name,
        accountId: values.accountId,
        cost: values.cost,
        amount: values.amount,
        link: values.link || null,
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

            <FormField
              control={form.control}
              name="accountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingAccounts}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

            <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount Saved</FormLabel>
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

            <DialogFooter>
              <Button type="submit">{editingItem ? 'Save Changes' : 'Add Goal'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
