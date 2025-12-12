
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
import { Switch } from '@/components/ui/switch';
import type { SavingsItem, SavingsRecurrence } from '@/types';
import { useAccounts } from '@/hooks/use-accounts';
import { useSinkingFundCategories } from '@/hooks/use-sinking-fund-categories';
import { ScrollArea } from '@/components/ui/scroll-area';


const formSchema = z.object({
  name: z.string().min(2, 'Fund name must be at least 2 characters.'),
  accountId: z.string().min(1, 'An account is required.'),
  amount: z.coerce.number().min(0, 'Amount must be a positive number.'),
  currency: z.enum(['CAD', 'USD']),
  goal: z.coerce.number().optional(),
  isCustomGoal: z.boolean().optional(),
  totalCost: z.coerce.number().optional(),
  dueDate: z.string().optional(),
  recurrence: z.enum(['None', 'Quarterly', 'Semi-Annually', 'Annually', 'Bi-Annually', 'Semi-Annually (Custom)']).optional(),
  primaryPaymentMonth: z.coerce.number().optional(),
  secondaryPaymentMonth: z.coerce.number().optional(),
  categoryId: z.string().optional(),
});

type SinkingFundFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addSavingsItem: (item: Omit<SavingsItem, 'id' | 'monthlyAmount'>) => void;
  updateSavingsItem: (id: string, item: Partial<Omit<SavingsItem, 'id' | 'monthlyAmount'>>) => void;
  editingItem: SavingsItem | null;
};

export function SinkingFundForm({ open, onOpenChange, addSavingsItem, updateSavingsItem, editingItem }: SinkingFundFormProps) {
  const { accounts, isLoading: isLoadingAccounts } = useAccounts();
  const { categories, isLoading: isLoadingCategories } = useSinkingFundCategories();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      accountId: '',
      amount: 0,
      currency: 'CAD',
      goal: 0,
      isCustomGoal: false,
      totalCost: 0,
      dueDate: '',
      recurrence: 'None',
      primaryPaymentMonth: 0,
      secondaryPaymentMonth: 6,
      categoryId: '',
    },
  });

  const recurrence = form.watch('recurrence');
  const isCustomGoal = form.watch('isCustomGoal');

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          name: editingItem.name,
          accountId: editingItem.accountId,
          amount: editingItem.amount,
          currency: editingItem.currency,
          goal: editingItem.goal || undefined,
          isCustomGoal: editingItem.isCustomGoal || false,
          totalCost: editingItem.totalCost || undefined,
          dueDate: editingItem.dueDate ? editingItem.dueDate.split('T')[0] : '',
          recurrence: editingItem.recurrence || 'None',
          primaryPaymentMonth: editingItem.primaryPaymentMonth || 0,
          secondaryPaymentMonth: editingItem.secondaryPaymentMonth || 6,
          categoryId: editingItem.categoryId || '',
        });
      } else {
        form.reset({
          name: '',
          accountId: accounts[0]?.id || '',
          amount: 0,
          currency: 'CAD',
          goal: undefined,
          isCustomGoal: false,
          totalCost: undefined,
          dueDate: '',
          recurrence: 'None',
          primaryPaymentMonth: 0,
          secondaryPaymentMonth: 6,
          categoryId: '',
        });
      }
    }
  }, [editingItem, open, form, accounts]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const submissionData = { 
        ...values, 
        recurrence: values.recurrence as SavingsRecurrence,
        goal: values.isCustomGoal ? values.goal : null,
    };

    if (editingItem) {
      updateSavingsItem(editingItem.id, submissionData);
    } else {
      addSavingsItem(submissionData);
    }
    onOpenChange(false);
  }

  const monthOptions = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: new Date(0, i).toLocaleString('default', { month: 'long' }),
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Sinking Fund' : 'Add New Sinking Fund'}</DialogTitle>
          <DialogDescription>
            {editingItem ? 'Update the details for this sinking fund.' : 'Create a new sinking fund for a future expense.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ScrollArea className="h-[60vh] pr-6 -mr-6">
              <div className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fund Name</FormLabel>
                      <FormControl><Input placeholder="e.g., Car Maintenance" {...field} /></FormControl>
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
                
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
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

                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="amount" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Current Balance</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField control={form.control} name="currency" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Currency</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="CAD">CAD</SelectItem>
                                    <SelectItem value="USD">USD</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}/>
                </div>

                <FormField control={form.control} name="totalCost" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Cost / Goal</FormLabel>
                      <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField control={form.control} name="dueDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Due Date (for one-time goals)</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="recurrence"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recurrence (for ongoing funds)</FormLabel>
                       <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select recurrence pattern" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="None">None (One-time Goal)</SelectItem>
                            <SelectItem value="Annually">Annually</SelectItem>
                            <SelectItem value="Semi-Annually">Semi-Annually (Jan/Jul)</SelectItem>
                            <SelectItem value="Semi-Annually (Custom)">Semi-Annually (Custom)</SelectItem>
                            <SelectItem value="Quarterly">Quarterly</SelectItem>
                            <SelectItem value="Bi-Annually">Bi-Annually</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {recurrence === 'Semi-Annually (Custom)' && (
                    <div className="grid grid-cols-2 gap-4">
                         <FormField
                            control={form.control}
                            name="primaryPaymentMonth"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>First Month</FormLabel>
                                    <Select onValueChange={(val) => field.onChange(parseInt(val))} value={String(field.value)}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {monthOptions.map(opt => <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="secondaryPaymentMonth"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Second Month</FormLabel>
                                    <Select onValueChange={(val) => field.onChange(parseInt(val))} value={String(field.value)}>
                                        <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                                        <SelectContent>
                                            {monthOptions.map(opt => <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                )}
                
                 <FormField
                    control={form.control}
                    name="isCustomGoal"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                            <FormLabel>Set Custom Monthly Goal</FormLabel>
                        </div>
                        <FormControl>
                            <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            />
                        </FormControl>
                        </FormItem>
                    )}
                    />

                {isCustomGoal && (
                     <FormField control={form.control} name="goal" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Monthly Contribution Goal</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                )}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button type="submit">{editingItem ? 'Save Changes' : 'Add Fund'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
