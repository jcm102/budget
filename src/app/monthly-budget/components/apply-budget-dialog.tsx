
'use client';

import { useState, useMemo } from 'react';
import * as z from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCommonAccounts } from '@/hooks/use-common-accounts';
import type { AccountDetails } from '@/types';

const formSchema = z.object({
  sourceAccountId: z.string().min(1, 'Please select a source account.'),
});

type ApplyBudgetDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryName: string;
  amount: number;
  accounts: AccountDetails[];
  onConfirm: (sourceAccountId: string) => void;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};


export function ApplyBudgetDialog({
  open,
  onOpenChange,
  categoryName,
  amount,
  accounts,
  onConfirm,
}: ApplyBudgetDialogProps) {
  const { commonAccountIds } = useCommonAccounts();
  
  const { commonAccounts, otherAccounts } = useMemo(() => {
    const common = accounts.filter(a => commonAccountIds.includes(a.id));
    const other = accounts.filter(a => !commonAccountIds.includes(a.id));
    return { commonAccounts: common, otherAccounts: other };
  }, [accounts, commonAccountIds]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceAccountId: commonAccounts[0]?.id || accounts[0]?.id || '',
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    onConfirm(values.sourceAccountId);
  };
  
  const renderAccountOptions = () => (
    <>
        {commonAccounts.length > 0 && (
            <SelectGroup>
                <SelectLabel>Commonly Used</SelectLabel>
                {commonAccounts.map(acc => (<SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>))}
            </SelectGroup>
        )}
        {otherAccounts.length > 0 && (
             <SelectGroup>
                <SelectLabel>Other</SelectLabel>
                {otherAccounts.map(acc => (<SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>))}
            </SelectGroup>
        )}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply Budgeted Amount</DialogTitle>
          <DialogDescription>
            Create a single transaction for the remaining budgeted amount of{' '}
            <span className="font-bold">{formatCurrency(amount)}</span> for the category &quot;{categoryName}&quot;.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="sourceAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Source</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an account" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {renderAccountOptions()}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Transaction</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
