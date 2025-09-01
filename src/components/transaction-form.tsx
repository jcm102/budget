
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
import type { Transaction, TransactionType } from '@/types';
import { useBudgetCategories } from '@/hooks/use-budget-categories';
import { useAccountDetails } from '@/hooks/use-transferees';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

const formSchema = z.object({
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero.'),
  date: z.string().min(1, 'A date is required.'),
  type: z.enum(['expense', 'transfer']),
  categoryId: z.string().optional(),
  transferFromId: z.string().optional(),
  transferToId: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'expense' && !data.categoryId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['categoryId'],
            message: 'Category is required for an expense.',
        });
    }
    if (data.type === 'transfer') {
        if (!data.transferFromId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['transferFromId'], message: 'Source account is required.' });
        }
        if (!data.transferToId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['transferToId'], message: 'Destination account is required.' });
        }
        if (data.transferFromId && data.transferToId && data.transferFromId === data.transferToId) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['transferToId'], message: 'Accounts cannot be the same.' });
        }
    }
});

type TransactionFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
};

export function TransactionForm({ open, onOpenChange, addTransaction }: TransactionFormProps) {
  const { categories, isLoading: isLoadingCategories } = useBudgetCategories();
  const { accounts, isLoading: isLoadingAccounts } = useAccountDetails();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      type: 'expense',
      categoryId: '',
      transferFromId: '',
      transferToId: '',
    },
  });

  const transactionType = form.watch('type');

  useEffect(() => {
    if (open) {
      form.reset({
        description: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        type: 'expense',
        categoryId: '',
        transferFromId: '',
        transferToId: '',
      });
    }
  }, [open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const [year, month, day] = values.date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    
    const dataToSubmit = {
        description: values.description,
        amount: values.amount,
        date: localDate.toISOString(),
        type: values.type as TransactionType,
        categoryId: values.type === 'expense' ? values.categoryId : undefined,
        transferFromId: values.type === 'transfer' ? values.transferFromId : undefined,
        transferToId: values.type === 'transfer' ? values.transferToId : undefined,
    }

    addTransaction(dataToSubmit);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Log a new expense or transfer to track it against your budget.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value="expense" /></FormControl>
                        <FormLabel className="font-normal">Expense</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value="transfer" /></FormControl>
                        <FormLabel className="font-normal">Transfer</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
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
             <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input placeholder="e.g., Groceries from store" {...field} /></FormControl>
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

            {transactionType === 'expense' && (
                <FormField control={form.control} name="categoryId" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingCategories}>
                        <FormControl>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            )}

            {transactionType === 'transfer' && (
                <div className="space-y-4">
                    <FormField control={form.control} name="transferFromId" render={({ field }) => (
                        <FormItem>
                        <FormLabel>From Account</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingAccounts}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select source account" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {accounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                     <FormField control={form.control} name="transferToId" render={({ field }) => (
                        <FormItem>
                        <FormLabel>To Account</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingAccounts}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select destination account" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {accounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
            )}

            <DialogFooter>
              <Button type="submit">Add Transaction</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
