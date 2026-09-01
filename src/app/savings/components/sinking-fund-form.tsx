

'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { useAccountDetails } from '@/hooks/use-account-details';
import { useSinkingFundCategories } from '@/hooks/use-sinking-fund-categories';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSelectedAccount } from '@/hooks/use-selected-account';


import { format } from 'date-fns';

const formSchema = z.object({
  name: z.string().min(2, 'Fund name must be at least 2 characters.'),
  accountId: z.string().min(1, 'An account is required.'),
  amount: z.coerce.number().min(0, 'Amount must be a positive number.'),
  currency: z.enum(['CAD', 'USD']),
  exchangeRateType: z.enum(['current', '5year', '10year']).optional(),
  goal: z.coerce.number().min(0).default(0),
  isCustomGoal: z.boolean().default(false),
  totalCost: z.coerce.number().min(0).default(0),
  dueDate: z.string().optional(),
  recurrence: z.enum(['None', 'Quarterly', 'Semi-Annually', 'Annually', 'Bi-Annually', 'Semi-Annually (Custom)']).default('None'),
  primaryPaymentMonth: z.coerce.number().min(0).default(0),
  secondaryPaymentMonth: z.coerce.number().min(0).default(6),
  categoryId: z.string().optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  activatedAt: z.string().optional(),
});

type SinkingFundFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addSavingsItem: (item: Omit<SavingsItem, 'id' | 'monthlyAmount'>) => void;
  updateSavingsItem: (id: string, item: Partial<Omit<SavingsItem, 'id' | 'monthlyAmount'>>) => void;
  editingItem: SavingsItem | null;
  prefillItem?: Partial<SavingsItem>;
};

export function SinkingFundForm({ open, onOpenChange, addSavingsItem, updateSavingsItem, editingItem, prefillItem }: SinkingFundFormProps) {
  const { accounts, isLoading: isLoadingAccounts } = useAccountDetails();
  const { categories, isLoading: isLoadingCategories } = useSinkingFundCategories();
  const { selectedAccountId } = useSelectedAccount();

  // Only show savings accounts in the account picker
  const savingsAccounts = useMemo(() => accounts.filter(a => a.type === 'Savings'), [accounts]);

  // Best default account: currently selected (if savings), else EQ Sinking Funds, else first savings account
  const defaultAccountId = useMemo(() => {
    if (savingsAccounts.find(a => a.id === selectedAccountId)) return selectedAccountId;
    const eq = savingsAccounts.find(a => a.name.toLowerCase().includes('sinking'));
    return eq?.id || savingsAccounts[0]?.id || '';
  }, [savingsAccounts, selectedAccountId]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      accountId: defaultAccountId || undefined,
      amount: 0,
      currency: 'CAD',
      exchangeRateType: 'current',
      goal: 0,
      isCustomGoal: false,
      totalCost: 0,
      dueDate: '',
      recurrence: 'None',
      primaryPaymentMonth: 0,
      secondaryPaymentMonth: 6,
      categoryId: '',
      status: 'active',
      activatedAt: format(new Date(), 'yyyy-MM-dd'),
    },
  });

  const recurrence = form.watch('recurrence');
  const isCustomGoal = form.watch('isCustomGoal');
  const status = form.watch('status');

  useEffect(() => {
    if (open) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      if (editingItem) {
        form.reset({
          name: editingItem.name,
          accountId: editingItem.accountId,
          amount: editingItem.amount ?? 0,
          currency: editingItem.currency,
          exchangeRateType: editingItem.exchangeRateType || 'current',
          goal: editingItem.goal ?? 0,
          isCustomGoal: editingItem.isCustomGoal || false,
          totalCost: editingItem.totalCost ?? 0,
          dueDate: editingItem.dueDate ? editingItem.dueDate.split('T')[0] : '',
          recurrence: editingItem.recurrence || 'None',
          primaryPaymentMonth: editingItem.primaryPaymentMonth ?? 0,
          secondaryPaymentMonth: editingItem.secondaryPaymentMonth ?? 6,
          categoryId: editingItem.categoryId || '',
          status: editingItem.status || 'active',
          activatedAt: editingItem.activatedAt ? editingItem.activatedAt.split('T')[0] : todayStr,
        });
      } else if (prefillItem) {
        form.reset({
          name: prefillItem.name || '',
          accountId: prefillItem.accountId || defaultAccountId || undefined,
          amount: 0,
          currency: prefillItem.currency || 'CAD',
          exchangeRateType: prefillItem.exchangeRateType || 'current',
          goal: prefillItem.goal || 0,
          isCustomGoal: prefillItem.isCustomGoal || false,
          totalCost: prefillItem.totalCost || 0,
          dueDate: prefillItem.dueDate ? prefillItem.dueDate.split('T')[0] : '',
          recurrence: prefillItem.recurrence || 'None',
          primaryPaymentMonth: prefillItem.primaryPaymentMonth || 0,
          secondaryPaymentMonth: prefillItem.secondaryPaymentMonth || 6,
          categoryId: prefillItem.categoryId || '',
          status: prefillItem.status || 'active',
          activatedAt: prefillItem.activatedAt ? prefillItem.activatedAt.split('T')[0] : todayStr,
        });
      } else {
        form.reset({
          name: '',
          accountId: defaultAccountId || undefined,
          amount: 0,
          currency: 'CAD',
          exchangeRateType: 'current',
          goal: 0,
          isCustomGoal: false,
          totalCost: 0,
          dueDate: '',
          recurrence: 'None',
          primaryPaymentMonth: 0,
          secondaryPaymentMonth: 6,
          categoryId: '',
          status: 'active',
          activatedAt: todayStr,
        });
      }
    }
  }, [editingItem, open, form, defaultAccountId, prefillItem]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let activatedAt = values.activatedAt;

    if (values.status === 'active') {
      if (!activatedAt || (editingItem && editingItem.status === 'inactive')) {
        activatedAt = todayStr;
      }
    } else {
      activatedAt = undefined;
    }

    const submissionData = { 
        ...values, 
        status: values.status,
        activatedAt: activatedAt || undefined,
        recurrence: values.recurrence as SavingsRecurrence,
        goal: values.isCustomGoal ? (values.goal || null) : null,
        totalCost: values.totalCost || null,
        ...(editingItem?.previousCycles ? { previousCycles: editingItem.previousCycles } : {})
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
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base font-semibold">Active Fund</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          {field.value === 'active' ? 'Fund is active and included in monthly target calculations.' : 'Fund is inactive and paused.'}
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value === 'active'}
                          onCheckedChange={(checked) => field.onChange(checked ? 'active' : 'inactive')}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {status === 'active' && (
                  <FormField control={form.control} name="activatedAt" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date Marked Active</FormLabel>
                        <FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

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
                          {savingsAccounts.map(account => (
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

                {form.watch('currency') === 'USD' && (
                    <FormField control={form.control} name="exchangeRateType" render={({ field }) => (
                        <FormItem>
                            <FormLabel>USD Conversion Rate Mode</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || 'current'}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="current">Current Rate (from Settings)</SelectItem>
                                    <SelectItem value="5year">5-Year Average (1.3344)</SelectItem>
                                    <SelectItem value="10year">10-Year Average (1.3260)</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}/>
                )}

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
                      <FormLabel>Due Date (Optional)</FormLabel>
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
