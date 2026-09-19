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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { MonthlyBudgetItem, BudgetSubItem, Category, AccountDetails } from '@/types';
import { PlusCircle, Trash2, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const breakdownItemSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  amount: z.coerce.number().min(0, 'Amount must be a positive number.'),
  paymentMethod: z.string().nullable().optional(),
  recurring: z.boolean().optional(),
  defaultAmount: z.coerce.number().nullable().optional(),
  isOneTimeException: z.boolean().optional(),
  notes: z.string().optional(),
  debtId: z.string().optional(),
  isWorksheet: z.boolean().optional(),
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
  accounts: AccountDetails[];
};

export function BudgetBreakdownForm({ open, onOpenChange, onSave, category, budgetItem, accounts }: BudgetBreakdownFormProps) {
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
        ? budgetItem.breakdown.map(item => {
            const hasException = !!(item.recurring && item.defaultAmount !== undefined && item.defaultAmount !== null && item.defaultAmount !== item.amount);
            return {
              name: item.name,
              amount: item.amount,
              paymentMethod: item.paymentMethod || null,
              recurring: item.recurring ?? true,
              defaultAmount: item.defaultAmount || null,
              isOneTimeException: hasException,
              notes: item.notes || '',
              debtId: (item as any).debtId || undefined,
              isWorksheet: !!(item as any).isWorksheet,
            };
          })
        : [{ name: 'Default', amount: budgetItem?.budgeted || 0, paymentMethod: category.paymentMethod || null, recurring: true, defaultAmount: null, isOneTimeException: false, notes: '', debtId: undefined, isWorksheet: false }];
      form.reset({ breakdown: initialBreakdown });
    }
  }, [category, budgetItem, open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (category) {
      const mappedBreakdown: BudgetSubItem[] = values.breakdown.map(item => {
        const isException = !!(item.recurring && item.isOneTimeException);
        const existingSub = budgetItem?.breakdown?.find(ex => ex.name === item.name);
        const baseline = existingSub?.defaultAmount ?? existingSub?.amount ?? item.amount;

        return {
          name: item.name,
          amount: item.amount,
          paymentMethod: item.paymentMethod || null,
          recurring: item.recurring ?? true,
          defaultAmount: isException ? baseline : item.amount,
          notes: item.notes || '',
          debtId: item.debtId || (existingSub as any)?.debtId,
          isWorksheet: item.isWorksheet ?? (existingSub as any)?.isWorksheet,
        };
      });
      onSave(category.id, mappedBreakdown);
    }
    onOpenChange(false);
  }

  const total = form.watch('breakdown').reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const isDebtCategory = category && ['Credit Cards', 'Loans', 'Line of Credit'].includes(category.name);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Budget for &quot;{category?.name}&quot;</DialogTitle>
          <DialogDescription>
            Break down your budget for this category into smaller items. The total will be your new budgeted amount.
          </DialogDescription>
        </DialogHeader>

        {isDebtCategory && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-md p-2.5 text-xs text-amber-900 dark:text-amber-200 flex flex-col gap-1">
            <div className="font-semibold flex items-center justify-between">
              <span>Worksheet Synced Category</span>
              <a
                href="/debt"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
              >
                Open Debt Worksheet <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <span>
              Debts tracked in the Debt Worksheet sync here automatically. Custom items you add here are preserved in your monthly budget.
            </span>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <ScrollArea className="h-64 pr-6">
                <div className="space-y-4">
                    {fields.map((field, index) => {
                      const isWorksheetItem = !!form.watch(`breakdown.${index}.isWorksheet`);
                      return (
                      <div key={field.id} className={cn("flex flex-col gap-2.5 p-3 border rounded-lg", isWorksheetItem && "bg-amber-50/20 border-amber-200/60")}>
                        <div className="grid grid-cols-3 gap-2 flex-grow">
                            <FormField
                                control={form.control}
                                name={`breakdown.${index}.name`}
                                render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center justify-between">
                                      <FormLabel className="text-xs">Item Name</FormLabel>
                                      {isWorksheetItem && (
                                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 text-amber-600 border-amber-300">
                                          Live Worksheet
                                        </Badge>
                                      )}
                                    </div>
                                    <FormControl>
                                    <Input placeholder="e.g., Shared" {...field} disabled={isWorksheetItem} />
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
                                    <FormLabel className="text-xs">
                                      Amount {isWorksheetItem && <span className="text-[10px] text-muted-foreground font-normal">(Synced)</span>}
                                    </FormLabel>
                                    <FormControl>
                                    <Input type="number" step="0.01" {...field} disabled={isWorksheetItem} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name={`breakdown.${index}.paymentMethod`}
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-xs">Payment Account</FormLabel>
                                    <Select 
                                      value={field.value || 'none'} 
                                      onValueChange={(val) => field.onChange(val === 'none' ? null : val)}
                                    >
                                      <FormControl>
                                        <SelectTrigger className="h-9 text-xs">
                                          <SelectValue placeholder="Account" />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="none">Category Default</SelectItem>
                                        {accounts.map(acc => (
                                          <SelectItem key={acc.id} value={acc.name}>{acc.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                        </div>
                        <div className="flex flex-wrap items-center justify-between mt-1 gap-2">
                          <div className="flex items-center gap-4">
                            <FormField
                                control={form.control}
                                name={`breakdown.${index}.recurring`}
                                render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                    <FormControl>
                                        <Checkbox 
                                            checked={field.value} 
                                            onCheckedChange={field.onChange} 
                                            disabled={isWorksheetItem}
                                        />
                                    </FormControl>
                                    <FormLabel className="text-xs font-normal text-muted-foreground cursor-pointer">
                                        Repeat Monthly
                                    </FormLabel>
                                </FormItem>
                                )}
                            />
                            {form.watch(`breakdown.${index}.recurring`) && (
                              <FormField
                                  control={form.control}
                                  name={`breakdown.${index}.isOneTimeException`}
                                  render={({ field }) => (
                                  <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                                      <FormControl>
                                          <Checkbox 
                                              checked={field.value} 
                                              onCheckedChange={field.onChange} 
                                              disabled={isWorksheetItem}
                                          />
                                      </FormControl>
                                      <FormLabel className="text-xs font-semibold text-primary cursor-pointer">
                                          This month only (one-time exception)
                                      </FormLabel>
                                  </FormItem>
                                  )}
                              />
                            )}
                          </div>
                          <FormField
                            control={form.control}
                            name={`breakdown.${index}.notes`}
                            render={({ field }) => (
                              <FormItem className="w-full mt-2">
                                <FormControl>
                                  <Input 
                                    placeholder="Add notes..." 
                                    className="h-8 text-xs" 
                                    {...field} 
                                    value={field.value || ''}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                            {isWorksheetItem ? (
                              <span className="text-[11px] text-muted-foreground italic">
                                Managed in Debt Worksheet
                              </span>
                            ) : (
                              <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-destructive hover:bg-destructive/10"
                                  onClick={() => remove(index)}
                              >
                                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Remove
                              </Button>
                            )}
                        </div>
                    </div>
                    );
                    })}
                </div>
            </ScrollArea>
             <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ name: '', amount: 0, paymentMethod: category?.paymentMethod || null, recurring: true, isWorksheet: false })}
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
