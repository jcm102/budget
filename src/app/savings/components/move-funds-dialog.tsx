
'use client';

import * as React from 'react';
import { useState } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight } from 'lucide-react';
import type { SavingsItem } from '@/types';
import * as SavingsService from '@/services/savings-service';
import { useUser } from '@/firebase';

const formSchema = z.object({
  fromFundId: z.string().min(1, 'Source fund is required.'),
  toFundId: z.string().min(1, 'Destination fund is required.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero.'),
}).refine(data => data.fromFundId !== data.toFundId, {
    message: "Source and destination funds cannot be the same.",
    path: ['toFundId'],
});

type MoveFundsDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  funds: SavingsItem[];
};

export function MoveFundsDialog({ isOpen, onOpenChange, funds }: MoveFundsDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fromFundId: '',
      toFundId: '',
      amount: 0,
    },
  });
  
  const fromFundId = form.watch('fromFundId');
  const selectedFromFund = funds.find(f => f.id === fromFundId);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
        toast({ title: "Error", description: "You must be logged in.", variant: "destructive"});
        return;
    }

    if (selectedFromFund && values.amount > selectedFromFund.amount) {
        form.setError("amount", {
            type: "manual",
            message: `Amount cannot be greater than the available balance of ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(selectedFromFund.amount)}.`
        });
        return;
    }
    
    setIsSubmitting(true);
    try {
      await SavingsService.moveSinkingFundMoney(values.fromFundId, values.toFundId, values.amount, user.uid);
      toast({
        title: 'Success!',
        description: 'Funds have been moved successfully.',
      });
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error('Failed to move funds:', error);
      toast({
        title: 'Error Moving Funds',
        description: 'There was a problem moving the funds. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Sinking Fund Money</DialogTitle>
          <DialogDescription>
            Transfer money from one sinking fund to another.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-end gap-2">
              <FormField
                control={form.control}
                name="fromFundId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select source fund" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {funds.map(fund => (
                          <SelectItem key={fund.id} value={fund.id}>{fund.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ArrowRight className="mx-auto hidden md:block" />
              <FormField
                control={form.control}
                name="toFundId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination fund" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {funds.map(fund => (
                          <SelectItem key={fund.id} value={fund.id}>{fund.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Move Funds
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
