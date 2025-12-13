'use client';

import { useEffect, useState } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { SavingsItem } from '@/types';
import { ArrowRightLeft } from 'lucide-react';

const formatCurrency = (amount: number, currency: 'CAD' | 'USD') => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

export function SinkingFundTransferForm({ open, onOpenChange, sourceFund, allFunds, onConfirm }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sourceFund: SavingsItem;
    allFunds: SavingsItem[];
    onConfirm: (fromFundId: string, toFundId: string, amount: number) => void;
}) {

  const formSchema = z.object({
    toFundId: z.string().min(1, 'Please select a destination fund.'),
    amount: z.coerce.number().min(0.01, 'Amount must be greater than zero.').max(sourceFund.amount, `Amount cannot exceed the source balance of ${formatCurrency(sourceFund.amount, sourceFund.currency)}.`),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      toFundId: '',
      amount: sourceFund.amount,
    },
  });
  
  useEffect(() => {
    form.reset({
      toFundId: '',
      amount: sourceFund.amount,
    });
  }, [sourceFund, form]);

  const destinationFunds = allFunds.filter(fund => fund.id !== sourceFund.id && fund.currency === sourceFund.currency);
  const selectedToFundId = form.watch('toFundId');
  const selectedToFund = allFunds.find(f => f.id === selectedToFundId);

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    onConfirm(sourceFund.id, values.toFundId, values.amount);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer Funds</DialogTitle>
          <DialogDescription>
            Move money from one sinking fund to another.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 my-4">
            <div className="p-4 border rounded-md text-center">
                <p className="text-sm text-muted-foreground">From</p>
                <p className="font-semibold">{sourceFund.name}</p>
                <p className="text-sm font-bold">{formatCurrency(sourceFund.amount, sourceFund.currency)}</p>
            </div>
            <div className="p-4 border rounded-md text-center">
                <p className="text-sm text-muted-foreground">To</p>
                <p className="font-semibold">{selectedToFund?.name || '...'}</p>
                <p className="text-sm font-bold">{formatCurrency(selectedToFund?.amount || 0, selectedToFund?.currency || 'USD')}</p>
            </div>
        </div>
        {destinationFunds.length === 0 && (
            <Alert variant="destructive">
                <ArrowRightLeft className="h-4 w-4" />
                <AlertDescription>
                    No other funds with the same currency ({sourceFund.currency}) are available to transfer to.
                </AlertDescription>
            </Alert>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="toFundId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destination Fund</FormLabel>
                   <Select onValueChange={field.onChange} value={field.value} disabled={destinationFunds.length === 0}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a fund" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {destinationFunds.map(fund => (
                        <SelectItem key={fund.id} value={fund.id}>{fund.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount to Transfer</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={destinationFunds.length === 0}>Confirm Transfer</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
