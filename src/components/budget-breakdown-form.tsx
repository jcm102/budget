
'use client';

import * as React from 'react';
import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
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
import type { MonthlyBudgetItem, BudgetSubItem, Category } from '@/types';
import { PlusCircle, Trash2 } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

const breakdownItemSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  amount: z.coerce.number().min(0, 'Amount must be a positive number.'),
});

const formSchema = z.object({
  breakdown: z.array(breakdownItemSchema),
});

type BudgetBreakdownFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (categoryId: string, breakdown: BudgetSubItem[]) => void;
  category: Category | null;
  budgetItem: MonthlyBudgetItem | null;
};

export function BudgetBreakdownForm({ open, onOpenChange, onSave, category, budgetItem }: BudgetBreakdownFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      breakdown: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'breakdown',
  });

  useEffect(() => {
    if (category) {
      const initialBreakdown = budgetItem?.breakdown?.length
        ? budgetItem.breakdown
        : [{ name: 'Default', amount: budgetItem?.budgeted || 0 }];
      form.reset({ breakdown: initialBreakdown });
    }
  }, [category, budgetItem, open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (category) {
      onSave(category.id, values.breakdown);
    }
    onOpenChange(false);
  }

  const total = form.watch('breakdown').reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Budget for &quot;{category?.name}&quot;</DialogTitle>
          <DialogDescription>
            Break down your budget for this category into smaller items. The total will be your new budgeted amount.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <ScrollArea className="h-64 pr-6">
                <div className="space-y-4">
                    {fields.map((field, index) => (
                    <div key={field.id} className="flex items-end gap-2 p-3 border rounded-lg">
                        <div className="grid grid-cols-2 gap-2 flex-grow">
                            <FormField
                                control={form.control}
                                name={`breakdown.${index}.name`}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Item Name</FormLabel>
                                    <FormControl>
                                    <Input placeholder="e.g., Shared" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`breakdown.${index}.amount`}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Amount</FormLabel>
                                    <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-destructive"
                            onClick={() => remove(index)}
                            disabled={fields.length <= 1}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                    ))}
                </div>
            </ScrollArea>
             <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ name: '', amount: 0 })}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Add Item
            </Button>
            
            <Separator />
            <div className="flex justify-between items-center font-semibold text-lg">
                <span>Total Budgeted:</span>
                <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total)}</span>
            </div>
            
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
