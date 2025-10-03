

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
import type { AutoShipItem, AutoShipFrequency, Category } from '@/types';
import { useAccounts } from '@/hooks/use-accounts';
import { useMonthlyBudget } from '@/app/monthly-budget/hooks/use-monthly-budget';

type CategoryWithChildren = Category & { children: CategoryWithChildren[] };

const formSchema = z.object({
  accountId: z.string().min(1, 'An account is required.'),
  item: z.string().min(2, 'Item name must be at least 2 characters.'),
  nextShipmentDate: z.string().min(1, 'A next shipment date is required.'),
  frequency: z.enum(['Monthly', 'Every 2 Months', 'Every 3 Months', 'Every 4 Months', 'Every 6 Months']),
  estimatedCost: z.coerce.number().min(0, 'Estimated cost must be a positive number.'),
  budgetCategoryId: z.string().optional(),
});

type AutoShipFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addAutoShipItem: (item: Omit<AutoShipItem, 'id'>) => void;
  updateAutoShipItem: (id: string, item: Omit<AutoShipItem, 'id'>) => void;
  editingItem: AutoShipItem | null;
};

export function AutoShipForm({ open, onOpenChange, addAutoShipItem, updateAutoShipItem, editingItem }: AutoShipFormProps) {
  const { accounts, isLoading: isLoadingAccounts } = useAccounts();
  const { categories: budgetCategories, isLoading: isLoadingCategories } = useMonthlyBudget();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      accountId: '',
      item: '',
      nextShipmentDate: '',
      frequency: 'Monthly',
      estimatedCost: 0,
      budgetCategoryId: '',
    },
  });
  
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
          item: editingItem.item,
          nextShipmentDate: editingItem.nextShipmentDate,
          frequency: editingItem.frequency,
          estimatedCost: editingItem.estimatedCost,
          budgetCategoryId: editingItem.budgetCategoryId || '',
        });
      } else {
        form.reset({
          accountId: accounts[0]?.id || '',
          item: '',
          nextShipmentDate: new Date().toISOString().split('T')[0],
          frequency: 'Monthly',
          estimatedCost: 0,
          budgetCategoryId: '',
        });
      }
    }
  }, [editingItem, open, form, accounts]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    
    const submissionData = { 
        ...values, 
        frequency: values.frequency as AutoShipFrequency,
        budgetCategoryId: values.budgetCategoryId === 'null' ? undefined : values.budgetCategoryId,
    };
    if (editingItem) {
      updateAutoShipItem(editingItem.id, submissionData);
    } else {
      addAutoShipItem(submissionData);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Auto-Ship Item' : 'Add New Auto-Ship Item'}</DialogTitle>
          <DialogDescription>
            {editingItem ? 'Update the details for your auto-ship item.' : 'Fill in the details for your new auto-ship item.'}
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
            <FormField control={form.control} name="item" render={({ field }) => (
                <FormItem>
                  <FormLabel>Item Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Dog Food" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="nextShipmentDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Next Shipment Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField control={form.control} name="frequency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Shipment Frequency</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                        <SelectItem value="Every 2 Months">Every 2 Months</SelectItem>
                        <SelectItem value="Every 3 Months">Every 3 Months</SelectItem>
                        <SelectItem value="Every 4 Months">Every 4 Months</SelectItem>
                        <SelectItem value="Every 6 Months">Every 6 Months</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="estimatedCost" render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated Cost</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
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
            <DialogFooter>
              <Button type="submit">{editingItem ? 'Save Changes' : 'Add Item'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
