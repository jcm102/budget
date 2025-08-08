
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
import type { SavingsItem, SavingsPurchaseFrequency } from '@/types';
import { Switch } from './ui/switch';

const formSchema = z.object({
  expense: z.string().min(2, 'Expense name must be at least 2 characters.'),
  purchaseFrequency: z.enum(['Semi-Annually', 'Annually', 'Every 2 Years', 'Every 3 Years', 'Every 4 Years', 'Every 5 Years']),
  cost: z.coerce.number().min(0, 'Cost must be a positive number.'),
  isSplit: z.boolean(),
  annualIncrease: z.coerce.number().min(0, 'Annual increase must be a positive number.'),
  renewalDate: z.string().min(1, 'A renewal date is required.'),
  totalBudgeted: z.coerce.number().min(0, 'Total budgeted must be a positive number.'),
});

type SavingsFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addSavingsItem: (item: Omit<SavingsItem, 'id'>) => void;
  updateSavingsItem: (id: string, item: Omit<SavingsItem, 'id'>) => void;
  editingItem: SavingsItem | null;
};

export function SavingsForm({ open, onOpenChange, addSavingsItem, updateSavingsItem, editingItem }: SavingsFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      expense: '',
      purchaseFrequency: 'Annually',
      cost: 0,
      isSplit: false,
      annualIncrease: 0,
      renewalDate: '',
      totalBudgeted: 0,
    },
  });

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          expense: editingItem.expense,
          purchaseFrequency: editingItem.purchaseFrequency,
          cost: editingItem.cost,
          isSplit: editingItem.isSplit || false,
          annualIncrease: editingItem.annualIncrease,
          renewalDate: new Date(editingItem.renewalDate).toISOString().split('T')[0],
          totalBudgeted: editingItem.totalBudgeted,
        });
      } else {
        form.reset({
          expense: '',
          purchaseFrequency: 'Annually',
          cost: 0,
          isSplit: false,
          annualIncrease: 0,
          renewalDate: new Date().toISOString().split('T')[0],
          totalBudgeted: 0,
        });
      }
    }
  }, [editingItem, open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const [year, month, day] = values.renewalDate.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    
    const submissionData = { 
        ...values, 
        renewalDate: localDate.toISOString(),
        purchaseFrequency: values.purchaseFrequency as SavingsPurchaseFrequency,
    };
    if (editingItem) {
      updateSavingsItem(editingItem.id, submissionData);
    } else {
      addSavingsItem(submissionData);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Savings Item' : 'Add New Savings Item'}</DialogTitle>
          <DialogDescription>
            {editingItem ? 'Update the details for your savings item.' : 'Fill in the details for your new savings item.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="expense" render={({ field }) => (
                <FormItem>
                  <FormLabel>Expense Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Car Insurance" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField control={form.control} name="purchaseFrequency" render={({ field }) => (
                <FormItem>
                  <FormLabel>Purchase Frequency</FormLabel>
                   <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Semi-Annually">Semi-Annually</SelectItem>
                      <SelectItem value="Annually">Annually</SelectItem>
                      <SelectItem value="Every 2 Years">Every 2 Years</SelectItem>
                      <SelectItem value="Every 3 Years">Every 3 Years</SelectItem>
                      <SelectItem value="Every 4 Years">Every 4 Years</SelectItem>
                      <SelectItem value="Every 5 Years">Every 5 Years</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex gap-4">
                <FormField control={form.control} name="cost" render={({ field }) => (
                    <FormItem className="flex-grow">
                    <FormLabel>Prior Cost</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField
                    control={form.control}
                    name="isSplit"
                    render={({ field }) => (
                    <FormItem className="flex flex-col items-start justify-center">
                        <FormLabel>Cost is Split?</FormLabel>
                        <FormControl>
                        <Switch
                            className="mt-2"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                        />
                        </FormControl>
                    </FormItem>
                    )}
                />
            </div>
             <FormField control={form.control} name="annualIncrease" render={({ field }) => (
                <FormItem>
                  <FormLabel>Annual Increase %</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="renewalDate" render={({ field }) => (
                <FormItem>
                  <FormLabel>Next Renewal Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="totalBudgeted" render={({ field }) => (
                <FormItem>
                  <FormLabel>Already Budgeted</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
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
