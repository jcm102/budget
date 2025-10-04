
'use client';

import { useEffect, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { differenceInMonths, set, getYear, isBefore, differenceInCalendarMonths, startOfToday, parse } from 'date-fns';
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
import type { SavingsItem, SavingsRecurrence } from '@/types';
import { useAccounts } from '@/hooks/use-accounts';
import { ScrollArea } from '@/components/ui/scroll-area';

const monthOptions = [
    { label: 'January', value: 1 },
    { label: 'February', value: 2 },
    { label: 'March', value: 3 },
    { label: 'April', value: 4 },
    { label: 'May', value: 5 },
    { label: 'June', value: 6 },
    { label: 'July', value: 7 },
    { label: 'August', value: 8 },
    { label: 'September', value: 9 },
    { label: 'October', value: 10 },
    { label: 'November', value: 11 },
    { label: 'December', value: 12 },
];

const calculateMonthlyAmount = (item: Partial<SavingsItem>): number => {
    const { totalCost, savingsTarget, amount, dueDate: dueDateStr, goal } = item;

    if (goal && goal > 0) return goal;
    if (!dueDateStr) return 0;

    const costToUse = savingsTarget && savingsTarget > 0 ? savingsTarget : totalCost;
    if (!costToUse || costToUse <= 0) return 0;

    const remainingAmount = costToUse - (amount || 0);
    if (remainingAmount <= 0) return 0;

    const today = startOfToday();
    const dueDate = parse(dueDateStr, "yyyy-MM-dd", new Date());

    if (isBefore(dueDate, today)) {
        return remainingAmount > 0 ? remainingAmount : 0;
    }
    
    let monthsRemaining = differenceInCalendarMonths(dueDate, today);
    
    if (monthsRemaining > 0) {
      monthsRemaining -= 1;
    }
    
    if (monthsRemaining <= 0) {
        return remainingAmount;
    }

    return remainingAmount / (monthsRemaining);
};


const formSchema = z.object({
  name: z.string().min(2, 'Fund name must be at least 2 characters.'),
  amount: z.coerce.number().min(0, 'Amount must be a positive number.'),
  accountId: z.string().min(1, 'An account is required.'),
  currency: z.enum(['CAD', 'USD']),
  goal: z.coerce.number().optional(), // Monthly contribution goal
  totalCost: z.coerce.number().optional(),
  savingsTarget: z.coerce.number().optional(),
  dueDate: z.string().optional(),
  recurrence: z.enum(['None', 'Quarterly', 'Semi-Annually', 'Annually', 'Bi-Annually', 'Semi-Annually (Custom)']).optional(),
  primaryPaymentMonth: z.coerce.number().optional(),
  secondaryPaymentMonth: z.coerce.number().optional(),
});

type SavingsFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addSavingsItem: (item: Omit<SavingsItem, 'id' | 'monthlyAmount'>) => void;
  updateSavingsItem: (id: string, item: Partial<Omit<SavingsItem, 'id' | 'monthlyAmount'>>) => void;
  editingItem: SavingsItem | null;
};

export function SavingsForm({ open, onOpenChange, addSavingsItem, updateSavingsItem, editingItem }: SavingsFormProps) {
  const { accounts, isLoading: isLoadingAccounts } = useAccounts();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      amount: 0,
      accountId: '',
      currency: 'CAD',
      goal: 0,
      totalCost: 0,
      savingsTarget: 0,
      dueDate: '',
      recurrence: 'None',
      primaryPaymentMonth: undefined,
      secondaryPaymentMonth: undefined,
    },
  });
  
  const watchedValues = form.watch();

   useEffect(() => {
    const newMonthlyGoal = calculateMonthlyAmount(watchedValues as Partial<SavingsItem>);
    if (newMonthlyGoal !== form.getValues('goal')) {
      form.setValue('goal', newMonthlyGoal < 0 ? 0 : newMonthlyGoal);
    }
  }, [watchedValues, form]);


  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          name: editingItem.name,
          amount: editingItem.amount,
          accountId: editingItem.accountId,
          currency: editingItem.currency || 'CAD',
          goal: editingItem.goal || 0,
          totalCost: editingItem.totalCost || 0,
          savingsTarget: editingItem.savingsTarget || 0,
          dueDate: editingItem.dueDate ? editingItem.dueDate.split('T')[0] : '',
          recurrence: editingItem.recurrence || 'None',
          primaryPaymentMonth: editingItem.primaryPaymentMonth || undefined,
          secondaryPaymentMonth: editingItem.secondaryPaymentMonth || undefined,
        });
      } else {
        form.reset({
          name: '',
          amount: 0,
          accountId: accounts[0]?.id || '',
          currency: 'CAD',
          goal: 0,
          totalCost: 0,
          savingsTarget: 0,
          dueDate: '',
          recurrence: 'None',
          primaryPaymentMonth: undefined,
          secondaryPaymentMonth: undefined,
        });
      }
    }
  }, [editingItem, open, form, accounts]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const submissionData = {
      name: values.name,
      accountId: values.accountId,
      amount: values.amount,
      currency: values.currency,
      goal: values.goal || 0,
      totalCost: values.totalCost || null,
      savingsTarget: values.savingsTarget || null,
      dueDate: values.dueDate ? values.dueDate.split('T')[0] : null,
      recurrence: values.recurrence as SavingsRecurrence,
      primaryPaymentMonth: values.recurrence === 'Semi-Annually (Custom)' ? values.primaryPaymentMonth : null,
      secondaryPaymentMonth: values.recurrence === 'Semi-Annually (Custom)' ? values.secondaryPaymentMonth : null,
    };

    if (editingItem) {
      updateSavingsItem(editingItem.id, submissionData);
    } else {
      addSavingsItem(submissionData);
    }
    onOpenChange(false);
  }

  const setSavingsTargetPercentage = (percentage: number) => {
    const totalCostValue = form.getValues('totalCost')
    if (totalCostValue && totalCostValue > 0) {
      const target = (totalCostValue * percentage) / 100;
      form.setValue('savingsTarget', parseFloat(target.toFixed(2)), { shouldValidate: true });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Sinking Fund' : 'Add New Sinking Fund'}</DialogTitle>
          <DialogDescription>
            {editingItem ? 'Update the details for your fund.' : 'Create a new fund category for your account. To link to a Goal, Subscription, or Auto-Shipment, ensure the name is an exact match.'}
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
                    <FormField control={form.control} name="currency" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Currency</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="CAD">CAD</SelectItem>
                                <SelectItem value="USD">USD</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField control={form.control} name="amount" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Current Amount Saved</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField control={form.control} name="totalCost" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Total Cost (Optional)</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField control={form.control} name="savingsTarget" render={({ field }) => (
                        <FormItem>
                            <FormLabel>My Savings Target (Optional)</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <div className="flex gap-2 -mt-2">
                        {[25, 50, 75, 100].map(p => (
                            <Button 
                            key={p} 
                            type="button" 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSavingsTargetPercentage(p)}
                            disabled={!watchedValues.totalCost || watchedValues.totalCost <= 0}
                            className="flex-1"
                            >
                            {p}%
                            </Button>
                        ))}
                    </div>
                    <FormField control={form.control} name="dueDate" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Due Date (Optional)</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField control={form.control} name="recurrence" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Recurrence</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                                <SelectItem value="None">None (One-Time)</SelectItem>
                                <SelectItem value="Quarterly">Quarterly</SelectItem>
                                <SelectItem value="Semi-Annually">Semi-Annually</SelectItem>
                                <SelectItem value="Semi-Annually (Custom)">Semi-Annually (Custom)</SelectItem>
                                <SelectItem value="Annually">Annually</SelectItem>
                                <SelectItem value="Bi-Annually">Bi-Annually</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    {watchedValues.recurrence === 'Semi-Annually (Custom)' && (
                        <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="primaryPaymentMonth" render={({ field }) => (
                            <FormItem>
                            <FormLabel>First Payment</FormLabel>
                            <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {monthOptions.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}/>
                        <FormField control={form.control} name="secondaryPaymentMonth" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Second Payment</FormLabel>
                            <Select onValueChange={(value) => field.onChange(parseInt(value))} value={field.value?.toString()}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {monthOptions.map(m => <SelectItem key={m.value} value={m.value.toString()}>{m.label}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}/>
                        </div>
                    )}
                    <FormField control={form.control} name="goal" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Monthly Contribution Goal</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} disabled /></FormControl>
                            <FormMessage />
                        </FormItem>
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
