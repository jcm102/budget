
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
import type { AccountLedgerItem } from '@/types';
import { useAccounts } from '@/hooks/use-accounts';

const formSchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters.'),
  amount: z.coerce.number().min(0, 'Amount must be a positive number.'),
  accountId: z.string().min(1, 'An account is required.'),
});

type AccountLedgerFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addItem: (item: Omit<AccountLedgerItem, 'id'>) => void;
  updateItem: (id: string, item: Partial<Omit<AccountLedgerItem, 'id'>>) => void;
  editingItem: AccountLedgerItem | null;
};

export function AccountLedgerForm({ open, onOpenChange, addItem, updateItem, editingItem }: AccountLedgerFormProps) {
  const { accounts, isLoading: isLoadingAccounts } = useAccounts();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      amount: 0,
      accountId: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          name: editingItem.name,
          amount: editingItem.amount,
          accountId: editingItem.accountId,
        });
      } else {
        form.reset({
          name: '',
          amount: 0,
          accountId: accounts[0]?.id || '',
        });
      }
    }
  }, [editingItem, open, form, accounts]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (editingItem) {
      updateItem(editingItem.id, values);
    } else {
      addItem(values);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Category' : 'Add New Category'}</DialogTitle>
          <DialogDescription>
            {editingItem ? 'Update the details for this category.' : 'Create a new category for your account ledger.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Category Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Emergency Fund" {...field} /></FormControl>
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
            <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Amount</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">{editingItem ? 'Save Changes' : 'Add Category'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
