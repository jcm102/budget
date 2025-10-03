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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, PlusCircle, User, Users, Info, Copy } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calculator } from '@/components/calculator';
import type { Transaction, TransactionSplit, AccountDetails, Category, MonthlyBudgetItem } from '@/types';
import { useMonthlyBudget } from '../hooks/use-monthly-budget';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';

type CategoryWithChildren = Category & { children: CategoryWithChildren[] };

const splitSchema = z.object({
    id: z.string(),
    type: z.enum(['expense', 'transfer']),
    amount: z.coerce.number().min(0, 'Amount must be a positive number.'),
    categoryId: z.string().optional(),
    budgetItemName: z.string().optional(),
    destinationAccountId: z.string().optional(),
});

const formSchema = z.object({
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero.'),
  date: z.string().min(1, 'A date is required.'),
  sourceAccountId: z.string().min(1, 'A source account is required.'),
  splits: z.array(splitSchema),
}).refine(data => {
    const totalSplitAmount = data.splits.reduce((sum, split) => sum + split.amount, 0);
    return Math.abs(totalSplitAmount - data.amount) < 0.01; // Allow for floating point inaccuracies
}, {
    message: 'The sum of the splits must equal the total transaction amount.',
    path: ['splits'],
});

type TransactionFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountDetails[];
  addTransaction: (item: Omit<Transaction, 'id'>) => void;
  updateTransaction: (id: string, item: Partial<Omit<Transaction, 'id'>>) => void;
  deleteTransaction: (id: string) => void;
  editingTransaction: Transaction | null;
  isPage?: boolean;
};

// This function ensures the date from a YYYY-MM-DD string is treated as local timezone, not UTC.
const toLocalISOString = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const tzOffset = -date.getTimezoneOffset();
    const diff = tzOffset >= 0 ? '+' : '-';
    const pad = (n: number) => `${Math.floor(Math.abs(n))}`.padStart(2, '0');
    return date.getFullYear() +
      '-' + pad(date.getMonth() + 1) +
      '-' + pad(date.getDate()) +
      'T' + pad(date.getHours()) +
      ':' + pad(date.getMinutes()) +
      ':' + pad(date.getSeconds()) +
      diff + pad(tzOffset / 60) +
      ':' + pad(tzOffset % 60);
};

export function TransactionForm({ open, onOpenChange, accounts, addTransaction, updateTransaction, editingTransaction, isPage = false }: TransactionFormProps) {
  const { categories, budgetItems } = useMonthlyBudget();
  const { toast } = useToast();
  
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

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'splits',
  });
  
  const categoryTree = useMemo(() => {
    const buildTree = (parentId: string | null = null): CategoryWithChildren[] => {
        return categories
            .filter(c => c.parentId === parentId)
            .map(c => ({
                ...c,
                children: buildTree(c.id),
            }));
    }
    return buildTree(null);
  }, [categories]);

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
          splits: [],
        });
      }
    }
  }, [editingTransaction, open, form]);

  const totalAmount = form.watch('amount');
  const splitAmounts = form.watch('splits');

  const remainingAmount = useMemo(() => {
    const totalSplit = splitAmounts.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    return totalAmount - totalSplit;
  }, [totalAmount, splitAmounts]);

  const handleAddSplit = (type: 'expense' | 'transfer') => {
    append({
        id: crypto.randomUUID(),
        type,
        amount: remainingAmount > 0 ? remainingAmount : 0,
        categoryId: '',
        budgetItemName: '',
        destinationAccountId: '',
    });
  };

  const getBreakdownOptions = (categoryId: string) => {
    const budgetItem = budgetItems.find(b => b.categoryId === categoryId);
    return budgetItem?.breakdown?.filter(b => b.name !== 'Default') || [];
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    const submissionData = { 
        ...values,
        date: toLocalISOString(values.date)
    };
    if (editingTransaction) {
      updateTransaction(editingTransaction.id, submissionData);
    } else {
      addTransaction(submissionData);
    }
    onOpenChange(false);
  }

  const handleUseCalculatorResult = (index: number) => (result: string) => {
    form.setValue(`splits.${index}.amount`, parseFloat(result), { shouldValidate: true });
  }

  const copyDescriptionToSplits = () => {
    const description = form.getValues('description');
    if (description) {
        toast({
            title: "Description copied!",
            description: "The main description has been copied to all split items."
        })
    }
  }

  const renderCategoryOptions = (nodes: CategoryWithChildren[], level = 0) => {
    if (!Array.isArray(nodes)) {
        return null;
    }
    return nodes.map(node => (
        <SelectGroup key={node.id}>
            <SelectItem value={node.id} style={{ paddingLeft: `${1 + level * 1.5}rem`, fontWeight: 500 }}>
                {node.name}
            </SelectItem>
            {node.children && node.children.length > 0 && renderCategoryOptions(node.children, level + 1)}
        </SelectGroup>
    ));
  };


  const formContent = (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 h-full flex flex-col">
          <ScrollArea className={cn(isPage ? "flex-grow" : "h-[65vh] pr-4")}>
            <div className="space-y-4">
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
                        <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {accounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <FormField control={form.control} name="amount" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Total Amount</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                 <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                        <div className="flex justify-between items-center">
                            <FormLabel>Description</FormLabel>
                             <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={copyDescriptionToSplits}>
                                <Copy className="mr-1 h-3 w-3" />
                                Copy to splits
                            </Button>
                        </div>
                        <FormControl><Textarea {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                 )}
                />

                <Separator />
                <div className="flex justify-between items-center">
                    <h4 className="font-medium">Transaction Splits</h4>
                    <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleAddSplit('expense')}>
                            <User className="mr-2 h-4 w-4" /> Expense
                        </Button>
                         <Button type="button" variant="outline" size="sm" onClick={() => handleAddSplit('transfer')}>
                            <Users className="mr-2 h-4 w-4" /> Transfer
                        </Button>
                    </div>
                </div>

                <div className="space-y-3">
                    {fields.map((field, index) => {
                        const split = form.watch(`splits.${index}`);
                        const breakdownOptions = getBreakdownOptions(split.categoryId || '');
                        
                        return (
                            <Card key={field.id} className="bg-secondary/50">
                                <CardHeader className="p-3 flex flex-row items-center justify-between">
                                    <CardTitle className="text-base">{split.type === 'expense' ? 'Expense' : 'Transfer'}</CardTitle>
                                    <div className="flex items-center">
                                       <Popover>
                                            <PopoverTrigger asChild>
                                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><Info className="h-4 w-4" /></Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[350px] p-0" align="end">
                                               <Calculator onUseResult={handleUseCalculatorResult(index)} />
                                            </PopoverContent>
                                        </Popover>
                                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(index)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-3 pt-0 grid gap-3">
                                     <FormField control={form.control} name={`splits.${index}.amount`} render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Amount</FormLabel>
                                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                     )}/>
                                      {split.type === 'expense' && (
                                        <>
                                           <FormField control={form.control} name={`splits.${index}.categoryId`} render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Category</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                                        <FormControl>
                                                        <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            {categoryTree.map(node => renderCategoryOptions([node]))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                           )}/>
                                           {breakdownOptions.length > 0 && (
                                                <FormField control={form.control} name={`splits.${index}.budgetItemName`} render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Budget Item</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                                            <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Select a specific item" /></SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {breakdownOptions.map(opt => (
                                                                    <SelectItem key={opt.name} value={opt.name}>{opt.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}/>
                                           )}
                                        </>
                                      )}
                                      {split.type === 'transfer' && (
                                          <FormField control={form.control} name={`splits.${index}.destinationAccountId`} render={({ field }) => (
                                            <FormItem>
                                            <FormLabel>Destination Account</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                                <FormControl>
                                                <SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                {accounts.map(acc => (
                                                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                                ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                            </FormItem>
                                        )}/>
                                      )}
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
                <div className={cn("text-right text-sm font-medium sticky bottom-0 bg-background/80 backdrop-blur-sm py-1 rounded-md", remainingAmount < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                   Amount left to assign: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(remainingAmount)}
                </div>
            </div>
          </ScrollArea>
           <DialogFooter className={cn(isPage && "mt-auto")}>
              <Button type="submit">{editingTransaction ? 'Save Changes' : 'Add Transaction'}</Button>
            </DialogFooter>
        </form>
    </Form>
  )
  
  if (isPage) {
    return formContent;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}</DialogTitle>
          <DialogDescription>
            Enter transaction details and split it across categories or transfers.
          </DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
