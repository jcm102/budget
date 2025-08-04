
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
import { Switch } from '@/components/ui/switch';
import type { Expense, MileageLog, ExpenseType } from '@/types';
import { useCategories } from '@/hooks/use-categories';
import { useTransferees } from '@/hooks/use-transferees';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

const formSchema = z.object({
  expenseType: z.enum(['Monetary', 'Mileage']),
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  date: z.string().min(1, 'A date is required.'),
  // Monetary fields
  amount: z.coerce.number().optional(),
  category: z.string().optional(),
  transferee: z.string().optional(),
  reimbursable: z.boolean(),
  // Mileage fields
  distance: z.coerce.number().optional(),
  rate: z.coerce.number().optional(),
}).refine(data => {
    if (data.expenseType === 'Monetary') {
        return !!data.amount && data.amount > 0 && !!data.category && !!data.transferee;
    }
    return true;
}, {
    message: 'Amount, category, and paid from are required for monetary expenses.',
    path: ['amount'],
}).refine(data => {
    if (data.expenseType === 'Mileage') {
        return !!data.distance && data.distance > 0 && data.rate !== undefined;
    }
    return true;
}, {
    message: 'Distance and rate are required for mileage expenses.',
    path: ['distance'],
});


type ExpenseFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addExpense: (item: Omit<Expense, 'id'>) => void;
  updateExpense: (id: string, item: Omit<Expense, 'id'>) => void;
  addMileage: (item: Omit<MileageLog, 'id'>) => void;
  updateMileage: (id: string, item: Omit<MileageLog, 'id'>) => void;
  editingItem: Expense | MileageLog | null;
};

export function ExpenseForm({ 
    open, 
    onOpenChange, 
    addExpense, 
    updateExpense, 
    addMileage,
    updateMileage,
    editingItem 
}: ExpenseFormProps) {
  const { categories } = useCategories();
  const { transferees } = useTransferees();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      expenseType: 'Monetary',
      description: '',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      category: '',
      transferee: '',
      reimbursable: false,
      distance: 0,
      rate: 0.50, // Default rate
    },
  });

  const expenseType = form.watch('expenseType');

  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          expenseType: editingItem.type,
          description: editingItem.description,
          date: new Date(editingItem.date).toISOString().split('T')[0],
          reimbursable: editingItem.reimbursable,
          amount: 'amount' in editingItem ? editingItem.amount : 0,
          category: 'category' in editingItem ? editingItem.category : '',
          transferee: 'transferee' in editingItem ? editingItem.transferee : '',
          distance: 'distance' in editingItem ? editingItem.distance : 0,
          rate: 'rate' in editingItem ? editingItem.rate : 0.50,
        });
      } else {
        form.reset({
          expenseType: 'Monetary',
          description: '',
          date: new Date().toISOString().split('T')[0],
          reimbursable: false,
          amount: 0,
          category: '',
          transferee: '',
          distance: 0,
          rate: 0.50,
        });
      }
    }
  }, [editingItem, open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const [year, month, day] = values.date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    
    if (values.expenseType === 'Monetary') {
        const submissionData: Omit<Expense, 'id'> = {
            type: 'Monetary',
            description: values.description,
            amount: values.amount!,
            category: values.category!,
            transferee: values.transferee!,
            date: localDate.toISOString(),
            reimbursable: values.reimbursable,
        };
        if (editingItem && editingItem.type === 'Monetary') {
            updateExpense(editingItem.id, submissionData);
        } else {
            addExpense(submissionData);
        }
    } else { // Mileage
        const submissionData: Omit<MileageLog, 'id'> = {
            type: 'Mileage',
            description: values.description,
            distance: values.distance!,
            rate: values.rate!,
            date: localDate.toISOString(),
            reimbursable: values.reimbursable,
        };
        if (editingItem && editingItem.type === 'Mileage') {
            updateMileage(editingItem.id, submissionData);
        } else {
            addMileage(submissionData);
        }
    }

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Work Expense' : 'Add New Work Expense'}</DialogTitle>
          <DialogDescription>
            {editingItem ? 'Update the details for your work expense.' : 'Fill in the details for your new work expense.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <FormField
                control={form.control}
                name="expenseType"
                render={({ field }) => (
                    <FormItem className="space-y-3">
                    <FormLabel>Expense Type</FormLabel>
                    <FormControl>
                        <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-4"
                        >
                        <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="Monetary" /></FormControl>
                            <FormLabel className="font-normal">Monetary</FormLabel>
                        </FormItem>
                        <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl><RadioGroupItem value="Mileage" /></FormControl>
                            <FormLabel className="font-normal">Mileage</FormLabel>
                        </FormItem>
                        </RadioGroup>
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
             />

            <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input placeholder={expenseType === 'Monetary' ? "e.g., Team Lunch" : "e.g., Client Visit"} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {expenseType === 'Monetary' && (
                <>
                    <FormField control={form.control} name="amount" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField control={form.control} name="category" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {categories.map(category => (
                                <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField control={form.control} name="transferee" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Paid From</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select a payment source" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                {transferees.map(t => (
                                <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </>
            )}

            {expenseType === 'Mileage' && (
                 <>
                    <FormField control={form.control} name="distance" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Distance (km)</FormLabel>
                            <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField control={form.control} name="rate" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Rate ($ per km)</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                    />
                </>
            )}

             <FormField
              control={form.control}
              name="reimbursable"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                  <div className="space-y-0.5">
                    <FormLabel>Reimbursable</FormLabel>
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
              <Button type="submit">{editingItem ? 'Save Changes' : 'Add Expense'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
