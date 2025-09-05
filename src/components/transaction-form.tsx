
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
import type { Transaction, TransactionType, Category as CategoryType, TransactionSplit, MonthlyBudgetItem, BudgetSubItem } from '@/types';
import { useMonthlyBudget } from '@/hooks/use-monthly-budget';
import { useAccountDetails } from '@/hooks/use-transferees';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { ScrollArea } from './ui/scroll-area';
import { Checkbox } from './ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ChevronRight, CornerDownRight, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { buttonVariants } from './ui/button';

const splitSchema = z.object({
    categoryId: z.string(),
    budgetItemName: z.string(),
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
    if (data.splits && data.splits.length > 0) {
        const totalSplitAmount = data.splits.reduce((sum, split) => sum + split.amount, 0);
        if (Math.abs(totalSplitAmount - data.amount) > 0.001) { // Check for floating point differences
                ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['amount'],
                message: `Split total (${totalSplitAmount.toFixed(2)}) must equal the transaction amount (${data.amount.toFixed(2)}).`,
            });
        }
    } else if (data.type === 'expense') {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['splits'],
            message: 'At least one category split is required for an expense.',
        });
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
  updateTransaction: (id: string, transaction: Partial<Omit<Transaction, 'id'>>) => void;
  deleteTransaction: (id: string) => void;
  editingTransaction: Transaction | null;
};

type CategoryWithChildren = CategoryType & { 
    children: CategoryWithChildren[];
    budgetItem: MonthlyBudgetItem | undefined;
};


const CategorySelectionRow = ({
    category,
    level,
    control,
    splits,
    append,
    remove
}: {
    category: CategoryWithChildren;
    level: number;
    control: any;
    splits: any[];
    append: (value: any) => void;
    remove: (index: number) => void;

}) => {
    const [isOpen, setIsOpen] = useState(false);
    const hasChildren = category.children.length > 0;
    
    const breakdownItems = category.budgetItem?.breakdown;
    const hasExplicitBreakdown = breakdownItems && breakdownItems.length > 0 && !(breakdownItems.length === 1 && breakdownItems[0].name === 'Default');

    const isSelectable = !hasExplicitBreakdown && (category.budgetItem?.budgeted ?? 0) > 0;
    
    const isCollapsible = hasChildren || hasExplicitBreakdown;

    const handleCheckboxChange = (checked: boolean, categoryId: string, budgetItemName: string, amount: number) => {
         const splitIndex = splits.findIndex(s => s.categoryId === categoryId && s.budgetItemName === budgetItemName);
         if (checked) {
            if(splitIndex === -1) {
                append({ categoryId, budgetItemName, amount });
            }
         } else {
            if(splitIndex !== -1) {
                remove(splitIndex);
            }
         }
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className="flex items-center gap-2 py-1">
                <div style={{ paddingLeft: `${level * 1.5}rem` }} className="flex-grow flex items-center gap-1">
                    {level > 0 && <CornerDownRight className="h-4 w-4 text-muted-foreground/70" />}
                     {isCollapsible && (
                        <CollapsibleTrigger asChild>
                             <Button variant="ghost" size="icon" className="h-6 w-6 -ml-1">
                                <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
                            </Button>
                        </CollapsibleTrigger>
                    )}
                    
                     {isSelectable ? (
                        <div className="flex items-center gap-2 flex-grow">
                             <Checkbox
                                id={`${category.id}-default`}
                                checked={splits.some(s => s.categoryId === category.id && s.budgetItemName === 'Default')}
                                onCheckedChange={(checked) => handleCheckboxChange(!!checked, category.id, 'Default', category.budgetItem?.budgeted || 0)}
                                className="mr-2"
                            />
                            <label htmlFor={`${category.id}-default`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {category.name}
                            </label>
                             {splits.some(s => s.categoryId === category.id && s.budgetItemName === 'Default') && (
                                <FormField
                                    control={control}
                                    name={`splits.${splits.findIndex(s => s.categoryId === category.id && s.budgetItemName === 'Default')}.amount`}
                                    render={({ field }) => (
                                        <FormControl>
                                            <Input
                                                {...field}
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                className="h-8 w-28 ml-auto text-right"
                                            />
                                        </FormControl>
                                    )}
                                />
                            )}
                        </div>
                    ) : (
                         <>
                            {!isCollapsible && <div className="w-6 h-6" />}
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                                {category.name}
                            </label>
                         </>
                    )}
                </div>
            </div>
            {isCollapsible && (
                <CollapsibleContent className="pl-4">
                    {hasExplicitBreakdown && breakdownItems?.map(item => {
                         const splitIndex = splits.findIndex(s => s.categoryId === category.id && s.budgetItemName === item.name);
                         const isChecked = splitIndex !== -1;
                        return (
                            <div key={item.name} className="flex items-center gap-2 py-1" style={{ paddingLeft: `${(level + 1) * 1.5}rem` }}>
                                <Checkbox
                                    id={`${category.id}-${item.name}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => handleCheckboxChange(!!checked, category.id, item.name, item.amount)}
                                    className="mr-2"
                                />
                                <label htmlFor={`${category.id}-${item.name}`} className="flex-grow text-sm font-normal">
                                    {item.name} ({new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.amount)})
                                </label>
                                {isChecked && (
                                    <FormField
                                        control={control}
                                        name={`splits.${splitIndex}.amount`}
                                        render={({ field }) => (
                                            <FormControl>
                                                <Input
                                                    {...field}
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0.00"
                                                    className="h-8 w-28 text-right"
                                                />
                                            </FormControl>
                                        )}
                                    />
                                )}
                            </div>
                        )
                    })}
                    {hasChildren && category.children.map(child => (
                         <CategorySelectionRow
                            key={child.id}
                            category={child}
                            level={level + 1}
                            control={control}
                            splits={splits}
                            append={append}
                            remove={remove}
                        />
                    ))}
                </CollapsibleContent>
            )}
        </Collapsible>
    )
}

export function TransactionForm({ open, onOpenChange, addTransaction, updateTransaction, deleteTransaction, editingTransaction }: TransactionFormProps) {
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
  
  const { fields: splitFields, append, remove } = useFieldArray({
      control: form.control,
      name: 'splits',
  });

  const transactionType = form.watch('type');
  const transactionAmount = form.watch('amount');
  const currentSplits = form.watch('splits') || [];
  
  const totalSplitAmount = useMemo(() => {
    return currentSplits.reduce((sum, split) => sum + (split.amount || 0), 0);
  }, [currentSplits]);

  const remainingToSplit = transactionAmount - totalSplitAmount;
  
  const categoryTree = useMemo(() => {
    const buildTree = (parentId: string | null = null): CategoryWithChildren[] => {
        return categories
            .filter(c => c.parentId === parentId)
            .map(c => ({
                ...c,
                children: buildTree(c.id),
                budgetItem: budgetItems.find(b => b.categoryId === c.id)
            }));
    }
    return buildTree(null);
  }, [categories, budgetItems]);

  useEffect(() => {
    if (open) {
      if (editingTransaction) {
        form.reset({
            description: editingTransaction.description,
            amount: editingTransaction.amount,
            date: new Date(editingTransaction.date).toISOString().split('T')[0],
            type: editingTransaction.type,
            transferFromId: editingTransaction.transferFromId || '',
            transferToId: editingTransaction.transferToId || '',
            splits: editingTransaction.splits || [],
        });
      } else {
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
    }
  }, [open, editingTransaction, form]);

  useEffect(() => {
    const { getValues, setValue } = form;
    if (transactionType === 'transfer') {
      const splits = getValues('splits');
      if (splits && splits.length > 0) {
        // Don't clear splits if there are any
      }
    }
  }, [transactionType, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const [year, month, day] = values.date.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    
    const dataToSubmit = {
        description: values.description,
        amount: values.amount,
        date: localDate.toISOString(),
        type: values.type as TransactionType,
        splits: values.splits?.filter(s => s.amount > 0),
        transferFromId: values.type === 'transfer' ? values.transferFromId : undefined,
        transferToId: values.type === 'transfer' ? values.transferToId : undefined,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</DialogTitle>
          <DialogDescription>
            {editingTransaction ? 'Update the details for this transaction.' : 'Log a new expense or transfer to track it against your budget.'}
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
                      disabled={!!editingTransaction}
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
            
            <div className="space-y-2">
                <FormLabel>Split Across Budget Items (Optional for Transfers)</FormLabel>
                    <ScrollArea className="h-52 rounded-md border p-2">
                    {categoryTree.map(cat => (
                        <CategorySelectionRow
                            key={cat.id}
                            category={cat}
                            level={0}
                            control={form.control}
                            splits={splitFields}
                            append={append}
                            remove={remove}
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
