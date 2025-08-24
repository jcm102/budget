
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
import type { SubscriptionItem, SubscriptionBillingFrequency } from '@/types';

const formSchema = z.object({
  serviceName: z.string().min(2, 'Service name must be at least 2 characters.'),
  billingFrequency: z.enum(['Monthly', 'Quarterly', 'Annually']),
  cost: z.coerce.number().min(0, 'Cost must be a positive number.'),
  nextRenewalDate: z.string().min(1, 'A renewal date is required.'),
});

type SubscriptionFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addSubscription: (item: Omit<SubscriptionItem, 'id'>) => void;
  updateSubscription: (id: string, item: Omit<SubscriptionItem, 'id'>) => void;
  editingItem: SubscriptionItem | null;
};

export function SubscriptionForm({ open, onOpenChange, addSubscription, updateSubscription, editingItem }: SubscriptionFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      serviceName: '',
      billingFrequency: 'Monthly',
      cost: 0,
      nextRenewalDate: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          serviceName: editingItem.serviceName,
          billingFrequency: editingItem.billingFrequency,
          cost: editingItem.cost,
          nextRenewalDate: new Date(editingItem.nextRenewalDate).toISOString().split('T')[0],
        });
      } else {
        form.reset({
          serviceName: '',
          billingFrequency: 'Monthly',
          cost: 0,
          nextRenewalDate: new Date().toISOString().split('T')[0],
        });
      }
    }
  }, [editingItem, open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const [year, month, day] = values.nextRenewalDate.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    
    const submissionData = { 
        ...values,
        billingFrequency: values.billingFrequency as SubscriptionBillingFrequency,
        nextRenewalDate: localDate.toISOString(),
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
            <DialogFooter>
              <Button type="submit">{editingItem ? 'Save Changes' : 'Add Subscription'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
