
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
import type { SavingsItem } from '@/types';

const formSchema = z.object({
  name: z.string().min(2, 'Fund name must be at least 2 characters.'),
  amount: z.coerce.number().min(0, 'Amount must be a positive number.'),
  goal: z.coerce.number().optional(),
});

type SavingsFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addSavingsItem: (item: Omit<SavingsItem, 'id'>) => void;
  updateSavingsItem: (id: string, item: Partial<Omit<SavingsItem, 'id'>>) => void;
  editingItem: SavingsItem | null;
};

export function SavingsForm({ open, onOpenChange, addSavingsItem, updateSavingsItem, editingItem }: SavingsFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      amount: 0,
      goal: 0,
    },
  });

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          name: editingItem.name,
          amount: editingItem.amount,
          goal: editingItem.goal || 0,
        });
      } else {
        form.reset({
          name: '',
          amount: 0,
          goal: 0,
        });
      }
    }
  }, [editingItem, open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (editingItem) {
      updateSavingsItem(editingItem.id, values);
    } else {
      addSavingsItem(values);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Sinking Fund' : 'Add New Sinking Fund'}</DialogTitle>
          <DialogDescription>
            {editingItem ? 'Update the details for your fund.' : 'Create a new fund category for your account.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fund Name</FormLabel>
                  <FormControl><Input placeholder="e.g., Car Maintenance" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Amount</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="goal" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Goal (Optional)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">{editingItem ? 'Save Changes' : 'Add Fund'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
