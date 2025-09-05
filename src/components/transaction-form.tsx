
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Transaction, TransactionType, Category as CategoryType, TransactionSplit, MonthlyBudgetItem } from '@/types';
import { useMonthlyBudget } from '@/hooks/use-monthly-budget';
import { useAccountDetails } from '@/hooks/use-transferees';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ChevronRight, CornerDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';

const splitSchema = z.object({
    categoryId: z.string(),
    amount: z.coerce.number().min(0.01, 'Amount must be positive.'),
});

const formSchema = z.object({
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero.'),
  date: z.string().min(1, 'A date is required.'),
  type: z.enum(['expense', 'transfer']),
  transferFromId: z.string().optional(),
  transferToId: z.string().optional(),
  splits: z.array(splitSchema).optional(),
}).superRefine((data, ctx) => {
    if (data.type === 'expense') {
        if (!data.splits || data.splits.length === 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['splits'],
                message: 'At least one category split is required for an expense.',
            });
        } else {
            const totalSplitAmount = data.splits.reduce((sum, split) => sum + split.amount, 0);
            if (Math.abs(totalSplitAmount - data.amount) > 0.001) { // Check for floating point differences
                 ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['amount'],
                    message: `Split total (${totalSplitAmount.toFixed(2)}) must equal the transaction amount (${data.amount.toFixed(2)}).`,
                });
            }
        }
    }
    if (data.type === 'transfer') {
        if (!data.transferFromId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['transferFromId'], message: 'Source account is required.' });
        }
        if (!data.transferToId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['transferToId'], message: 'Destination account is required.' });
        }
        if (data.transferFromId && data.transferToId && data.transferFromId === data.transferToId) {
             ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['transferToId'], message: 'Accounts cannot be the same.' });
        }
    }
});


type TransactionFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => void;
};

type CategoryWithChildren = CategoryType & { children: CategoryWithChildren[] };


const CategorySelectionRow = ({ 
    category,
    level,
    control,
    onSplitChange,
    getValues,
    setValue
}: {
    category: CategoryWithChildren,
    level: number,
    control: any,
    onSplitChange: (categoryId: string, checked: boolean) => void,
    getValues: any,
    setValue: any,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = category.children.length > 0;
    
    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className="flex items-center gap-2 py-1">
                <div style={{ paddingLeft: `${level * 1.5}rem` }} className="flex-grow flex items-center gap-1">
                    {level > 0 && <CornerDownRight className="h-4 w-4 text-muted-foreground/70" />}
                    {hasChildren && (
                        <CollapsibleTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-6 w-6 -ml-1">
                                <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
                            </Button>
                        </CollapsibleTrigger>
                    )}
                    <Checkbox
                        id={category.id}
                        onCheckedChange={(checked) => onSplitChange(category.id, !!checked)}
                        className="mr-2"
                    />
                    <label htmlFor={category.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {category.name}
                    </label>
                </div>
                 <FormField
                    control={control}
                    name={`splits.${category.id}.amount`}
                    render={({ field }) => (
                         <FormControl>
                            <Input
                                {...field}
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                className="h-8 w-28 text-right"
                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                        </FormControl>
                    )}
                 />
            </div>
            {hasChildren && (
                <CollapsibleContent>
                    {category.children.map(child => (
                         <CategorySelectionRow
                            key={child.id}
                            category={child}
                            level={level + 1}
                            control={control}
                            onSplitChange={onSplitChange}
                            getValues={getValues}
                            setValue={setValue}
                        />
                    ))}
                </CollapsibleContent>
            )}
        </Collapsible>
    )
}

export function TransactionForm({ open, onOpenChange, addTransaction }: TransactionFormProps) {
  const { categories, budgetItems, isLoading: isLoadingCategories } = useMonthlyBudget();
  const { accounts, isLoading: isLoadingAccounts } = useAccountDetails();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      type: 'expense',
      transferFromId: '',
      transferToId: '',
      splits: [],
    },
  });

  const transactionType = form.watch('type');
  const transactionAmount = form.watch('amount');
  const splits = form.watch('splits');
  
  const totalSplitAmount = useMemo(() => {
    return splits?.reduce((sum, split) => sum + (split.amount || 0), 0) || 0;
  }, [splits]);

  const remainingToSplit = transactionAmount - totalSplitAmount;
  
  const categoryTree = useMemo(() => {
    const tree: CategoryWithChildren[] = [];
    const map: { [key: string]: CategoryWithChildren } = {};
    categories.forEach(cat => map[cat.id] = { ...cat, children: [] });
    categories.forEach(cat => {
      if (cat.parentId && map[cat.parentId]) {
        map[cat.parentId].children.push(map[cat.id]);
      } else {
        tree.push(map[cat.id]);
      }
    });
    return tree;
  }, [categories]);

  useEffect(() => {
    if (open) {
      form.reset({
        description: '',
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        type: 'expense',
        transferFromId: '',
        transferToId: '',
        splits: [],
      });
    }
  }, [open, form]);
  
  const handleSplitChange = (categoryId: string, checked: boolean) => {
    const currentSplits = form.getValues('splits') || [];
    if (checked) {
        if (!currentSplits.some(s => s.categoryId === categoryId)) {
            form.setValue('splits', [...currentSplits, { categoryId, amount: 0 }]);
        }
    } else {
        form.setValue('splits', currentSplits.filter(s => s.categoryId !== categoryId));
    }
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    const [year, month, day] = values.date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    
    const dataToSubmit = {
        description: values.description,
        amount: values.amount,
        date: localDate.toISOString(),
        type: values.type as TransactionType,
        splits: values.type === 'expense' ? values.splits?.filter(s => s.amount > 0) : undefined,
        transferFromId: values.type === 'transfer' ? values.transferFromId : undefined,
        transferToId: values.type === 'transfer' ? values.transferToId : undefined,
    }

    addTransaction(dataToSubmit);
    onOpenChange(false);
  }
  
  const activeSplitCategoryIds = useMemo(() => new Set(splits?.map(s => s.categoryId) || []), [splits]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Log a new expense or transfer to track it against your budget.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
             <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex space-x-4"
                    >
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value="expense" /></FormControl>
                        <FormLabel className="font-normal">Expense</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-2 space-y-0">
                        <FormControl><RadioGroupItem value="transfer" /></FormControl>
                        <FormLabel className="font-normal">Transfer</FormLabel>
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

            {transactionType === 'expense' && (
                <div className="space-y-2">
                    <FormLabel>Split Across Categories</FormLabel>
                     <ScrollArea className="h-52 rounded-md border p-2">
                        {categoryTree.map(cat => (
                            <CategorySelectionRow
                                key={cat.id}
                                category={cat}
                                level={0}
                                control={form.control}
                                onSplitChange={handleSplitChange}
                                getValues={form.getValues}
                                setValue={form.setValue}
                            />
                        ))}
                    </ScrollArea>
                    <div className="p-3 bg-muted/50 rounded-md text-sm">
                        <div className="flex justify-between">
                            <span>Total Assigned:</span>
                            <span className="font-medium">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalSplitAmount)}</span>
                        </div>
                        <Separator className="my-1.5"/>
                         <div className={`flex justify-between font-semibold ${remainingToSplit < 0 ? 'text-destructive' : ''}`}>
                            <span>Remaining:</span>
                            <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(remainingToSplit)}</span>
                        </div>
                    </div>
                </div>
            )}

            {transactionType === 'transfer' && (
                <div className="space-y-4">
                    <FormField control={form.control} name="transferFromId" render={({ field }) => (
                        <FormItem>
                        <FormLabel>From Account</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingAccounts}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select source account" /></SelectTrigger>
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
                     <FormField control={form.control} name="transferToId" render={({ field }) => (
                        <FormItem>
                        <FormLabel>To Account</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingAccounts}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select destination account" /></SelectTrigger>
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
            )}

            <DialogFooter>
              <Button type="submit">Add Transaction</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
