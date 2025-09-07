

'use client';

import { useEffect, useState, useMemo } from 'react';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import type { Transaction, Category as CategoryType, AccountDetails, SplitType } from '@/types';
import { useMonthlyBudget } from '@/hooks/use-monthly-budget';
import { ScrollArea } from './ui/scroll-area';
import { CornerDownRight, Trash2, PlusCircle, ArrowRightLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { buttonVariants } from './ui/button';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';

const splitSchema = z.object({
    id: z.string(),
    type: z.enum(['expense', 'transfer']),
    amount: z.coerce.number().min(0.01, 'Amount must be positive.'),
    categoryId: z.string().optional(),
    budgetItemName: z.string().optional(),
    destinationAccountId: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'expense' && !data.categoryId) {
        ctx.addIssue({ code: 'custom', path: ['categoryId'], message: 'Category is required for expense splits.' });
    }
    if (data.type === 'transfer' && !data.destinationAccountId) {
        ctx.addIssue({ code: 'custom', path: ['destinationAccountId'], message: 'Destination account is required for transfers.' });
    }
});

const formSchema = z.object({
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero.'),
  date: z.string().min(1, 'A date is required.'),
  sourceAccountId: z.string().min(1, 'Source account is required.'),
  splits: z.array(splitSchema).min(1, 'At least one split is required.'),
}).superRefine((data, ctx) => {
    const totalSplitAmount = data.splits.reduce((sum, split) => sum + split.amount, 0);
    if (Math.abs(totalSplitAmount - data.amount) > 0.001) { // Check for floating point differences
            ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['amount'],
            message: `Split total (${totalSplitAmount.toFixed(2)}) must equal the transaction amount (${data.amount.toFixed(2)}).`,
        });
    }
});


type TransactionFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountDetails[];
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, transaction: Partial<Omit<Transaction, 'id'>>) => void;
  deleteTransaction: (id: string, accountId?: string) => void;
  editingTransaction: Transaction | null;
};


export function TransactionForm({ open, onOpenChange, accounts, addTransaction, updateTransaction, deleteTransaction, editingTransaction }: TransactionFormProps) {
  const { categories, budgetItems, isLoading: isLoadingCategories } = useMonthlyBudget();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      sourceAccountId: '',
      splits: [],
    },
  });
  
  const { fields: splitFields, append, remove, update } = useFieldArray({
      control: form.control,
      name: 'splits',
  });

  const transactionAmount = form.watch('amount');
  const currentSplits = form.watch('splits') || [];
  
  const totalSplitAmount = useMemo(() => {
    return currentSplits.reduce((sum, split) => sum + (split.amount || 0), 0);
  }, [currentSplits]);

  const remainingToSplit = transactionAmount - totalSplitAmount;
  
  useEffect(() => {
    if (open) {
      if (editingTransaction) {
        form.reset({
            description: editingTransaction.description,
            amount: editingTransaction.amount,
            date: new Date(editingTransaction.date).toISOString().split('T')[0],
            sourceAccountId: editingTransaction.sourceAccountId,
            splits: editingTransaction.splits || [],
        });
      } else {
         form.reset({
            description: '',
            amount: 0,
            date: new Date().toISOString().split('T')[0],
            sourceAccountId: '',
            splits: [{ id: crypto.randomUUID(), type: 'expense', amount: 0, categoryId: '' }],
        });
      }
    }
  }, [open, editingTransaction, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const [year, month, day] = values.date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    
    const dataToSubmit = {
        description: values.description,
        amount: values.amount,
        date: localDate.toISOString(),
        sourceAccountId: values.sourceAccountId,
        splits: values.splits.map(s => ({
            id: s.id,
            type: s.type,
            amount: s.amount,
            categoryId: s.type === 'expense' ? s.categoryId : undefined,
            budgetItemName: s.type === 'expense' ? 'Default' : undefined,
            destinationAccountId: s.type === 'transfer' ? s.destinationAccountId : undefined,
        })),
    }

    if (editingTransaction) {
        updateTransaction(editingTransaction.id, dataToSubmit);
    } else {
        addTransaction(dataToSubmit);
    }
    onOpenChange(false);
  }
  
  const handleDelete = () => {
    if (editingTransaction) {
      deleteTransaction(editingTransaction.id);
      onOpenChange(false);
    }
  }

  const formatCurrency = (amount: number | undefined) => {
    if (amount === undefined) return '';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };
  
  const categoryTree = useMemo(() => {
      const buildTree = (parentId: string | null = null) => {
          return categories
              .filter(c => c.parentId === parentId)
              .map(c => ({
                  ...c,
                  children: buildTree(c.id),
              }));
      }
      return buildTree(null);
  }, [categories]);

  const renderCategoryOptions = (nodes: any[], level = 0) => {
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


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
          <DialogDescription>
            {editingTransaction ? 'Update the details for this transaction.' : 'Log a new transaction to track it against your budget.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                 <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField control={form.control} name="sourceAccountId" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Source Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select payment source" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                        {accounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>
                                {acc.name} ({formatCurrency(acc.balance)})
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
             <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input placeholder="e.g., Groceries from store" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Amount</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Separator />
            
            <div className="space-y-2">
                <FormLabel>Transaction Splits</FormLabel>
                <div className="space-y-3">
                    {splitFields.map((field, index) => (
                        <div key={field.id} className="p-3 border rounded-lg space-y-3">
                            <FormField
                                control={form.control}
                                name={`splits.${index}.type`}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                            <RadioGroup
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            className="flex gap-4"
                                            >
                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                    <FormControl><RadioGroupItem value="expense" /></FormControl>
                                                    <Label className="font-normal">Expense</Label>
                                                </FormItem>
                                                <FormItem className="flex items-center space-x-2 space-y-0">
                                                    <FormControl><RadioGroupItem value="transfer" /></FormControl>
                                                    <Label className="font-normal">Transfer</Label>
                                                </FormItem>
                                            </RadioGroup>
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                            <div className="flex items-end gap-2">
                                <div className="flex-grow">
                                  {currentSplits[index]?.type === 'expense' ? (
                                     <FormField
                                        control={form.control}
                                        name={`splits.${index}.categoryId`}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="sr-only">Category</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Select a category"/></SelectTrigger></FormControl>
                                                    <SelectContent>{renderCategoryOptions(categoryTree)}</SelectContent>
                                                </Select>
                                            </FormItem>
                                        )}
                                     />
                                  ) : (
                                    <FormField
                                        control={form.control}
                                        name={`splits.${index}.destinationAccountId`}
                                        render={({ field }) => (
                                             <FormItem>
                                                <FormLabel className="sr-only">Destination Account</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl><SelectTrigger><SelectValue placeholder="Select destination account"/></SelectTrigger></FormControl>
                                                    <SelectContent>
                                                        {accounts.map(acc => (
                                                            <SelectItem key={acc.id} value={acc.id} disabled={acc.id === form.getValues('sourceAccountId')}>
                                                                {acc.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                             </FormItem>
                                        )}
                                    />
                                  )}
                                </div>
                                 <FormField
                                    control={form.control}
                                    name={`splits.${index}.amount`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="sr-only">Amount</FormLabel>
                                            <FormControl><Input type="number" step="0.01" className="w-32" placeholder="Amount" {...field} /></FormControl>
                                        </FormItem>
                                    )}
                                />
                                <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={() => remove(index)} disabled={splitFields.length <= 1}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
                 <Button type="button" variant="outline" size="sm" onClick={() => append({ id: crypto.randomUUID(), type: 'expense', amount: 0, categoryId: '' })}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Split
                </Button>

                <div className="p-3 bg-muted/50 rounded-md text-sm">
                    <div className="flex justify-between">
                        <span>Total Split:</span>
                        <span className="font-medium">{formatCurrency(totalSplitAmount)}</span>
                    </div>
                    <Separator className="my-1.5"/>
                        <div className={`flex justify-between font-semibold ${remainingToSplit < 0 ? 'text-destructive' : ''}`}>
                        <span>Remaining:</span>
                        <span>{formatCurrency(remainingToSplit)}</span>
                    </div>
                </div>
                 <FormMessage>
                    {form.formState.errors.amount?.message}
                </FormMessage>
            </div>

            <DialogFooter className="sm:justify-between">
                <div>
                    {editingTransaction && (
                        <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button type="button" variant="destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete this transaction.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleDelete}
                                className={cn(buttonVariants({ variant: "destructive" }))}
                            >
                                Confirm Delete
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
                <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="submit">{editingTransaction ? 'Save Changes' : 'Add Transaction'}</Button>
                </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
