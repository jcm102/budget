
'use client';

import { useEffect, useMemo } from 'react';
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
import type { SubscriptionItem, SubscriptionBillingFrequency, Category } from '@/types';
import { useAccounts } from '@/hooks/use-accounts';
import { useMonthlyBudget } from '@/hooks/use-monthly-budget';
import { Switch } from './ui/switch';

type CategoryWithChildren = Category & { children: CategoryWithChildren[] };


const formSchema = z.object({
  accountId: z.string().min(1, 'An account is required.'),
  serviceName: z.string().min(2, 'Service name must be at least 2 characters.'),
  billingFrequency: z.enum(['Monthly', 'Quarterly', 'Annually']),
  cost: z.coerce.number().min(0, 'Cost must be a positive number.'),
  nextRenewalDate: z.string().min(1, 'A renewal date is required.'),
  budgetCategoryId: z.string().optional(),
  includeInSinkingFund: z.boolean().optional(),
});

type SubscriptionFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addSubscription: (item: Omit<SubscriptionItem, 'id'>) => void;
  updateSubscription: (id: string, item: Omit<SubscriptionItem, 'id'>) => void;
  editingItem: SubscriptionItem | null;
};

export function SubscriptionForm({ open, onOpenChange, addSubscription, updateSubscription, editingItem }: SubscriptionFormProps) {
  const { accounts, isLoading: isLoadingAccounts } = useAccounts();
  const { categories: budgetCategories, isLoading: isLoadingCategories } = useMonthlyBudget();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountId: '',
      serviceName: '',
      billingFrequency: 'Monthly',
      cost: 0,
      nextRenewalDate: '',
      budgetCategoryId: '',
      includeInSinkingFund: false,
    },
  });

  const billingFrequency = form.watch('billingFrequency');

  useEffect(() => {
    if (billingFrequency === 'Monthly') {
      form.setValue('includeInSinkingFund', false);
    } else {
      form.setValue('includeInSinkingFund', true);
    }
  }, [billingFrequency, form]);

  const categoryTree = useMemo(() => {
    const buildTree = (parentId: string | null = null): CategoryWithChildren[] => {
        return budgetCategories
            .filter(c => c.parentId === parentId)
            .map(c => ({
                ...c,
                children: buildTree(c.id),
            }));
    }
    return buildTree(null);
  }, [budgetCategories]);

  const renderCategoryOptions = (nodes: CategoryWithChildren[], level = 0) => {
    let options: JSX.Element[] = [];
    nodes.forEach(node => {
        options.push(
            <SelectItem key={node.id} value={node.id} style={{ paddingLeft: `${1 + level * 1}rem` }}>
                {node.name}
            </SelectItem>
        );
        if (node.children.length > 0) {
            options = options.concat(renderCategoryOptions(node.children, level + 1));
        }
    });
    return options;
  };


  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          accountId: editingItem.accountId,
          serviceName: editingItem.serviceName,
          billingFrequency: editingItem.billingFrequency,
          cost: editingItem.cost,
          nextRenewalDate: editingItem.nextRenewalDate ? new Date(editingItem.nextRenewalDate).toISOString().split('T')[0] : '',
          budgetCategoryId: editingItem.budgetCategoryId || '',
          includeInSinkingFund: editingItem.includeInSinkingFund ?? (editingItem.billingFrequency !== 'Monthly'),
        });
      } else {
        form.reset({
          accountId: accounts[0]?.id || '',
          serviceName: '',
          billingFrequency: 'Monthly',
          cost: 0,
          nextRenewalDate: new Date().toISOString().split('T')[0],
          budgetCategoryId: '',
          includeInSinkingFund: false,
        });
      }
    }
  }, [editingItem, open, form, accounts]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const [year, month, day] = values.nextRenewalDate.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    
    const submissionData = { 
        ...values,
        billingFrequency: values.billingFrequency as SubscriptionBillingFrequency,
        nextRenewalDate: localDate.toISOString(),
        budgetCategoryId: values.budgetCategoryId === 'null' ? undefined : values.budgetCategoryId,
    };

    if (editingItem) {
      updateSubscription(editingItem.id, submissionData);
    } else {
      addSubscription(submissionData);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Subscription' : 'Add New Subscription'}</DialogTitle>
          <DialogDescription>
            {editingItem ? 'Update the details for your subscription.' : 'Fill in the details for your new subscription.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
            <FormField control={form.control} name="serviceName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Service Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Netflix" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField control={form.control} name="billingFrequency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing Frequency</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                        <SelectItem value="Quarterly">Quarterly</SelectItem>
                        <SelectItem value="Annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="cost" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cost per Billing Cycle</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField control={form.control} name="nextRenewalDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Next Renewal Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="budgetCategoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Budget Category (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value} disabled={isLoadingCategories}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Link to a budget category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="null">None</SelectItem>
                      {renderCategoryOptions(categoryTree)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
                control={form.control}
                name="includeInSinkingFund"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Include in Sinking Funds</FormLabel>
                      <FormMessage />
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
            <DialogFooter>
              <Button type="submit">{editingItem ? 'Save Changes' : 'Add Subscription'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
