

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
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import type { BudgetItem, BudgetItemType, BudgetItemFrequency, Category, MonthlyBudgetItem } from '@/types';
import { useIncomeCategories } from '@/hooks/use-income-categories';
import { useAccountDetails } from '@/hooks/use-transferees';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useGoals } from '@/app/savings/hooks/use-goals';
import { useDebt } from '@/app/debt/hooks/use-debt';
import * as GoalService from '@/services/goal-service';
import * as DebtService from '@/app/debt/services/debt-service';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, ChevronsUpDown } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useMonthlyBudget } from '@/app/monthly-budget/hooks/use-monthly-budget';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type CategoryWithChildren = Category & { children: CategoryWithChildren[] };

const formSchema = z.object({
    description: z.string().min(2, 'Description must be at least 2 characters.'),
    category: z.string().min(1, 'Category is required.'),
    amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
    type: z.enum(['Income', 'Debt Payments', 'Transfers', 'Pre-Authorized Payments']),
    date: z.string().min(1, 'A date is required.'),
    frequency: z.enum(['One-Time', 'Weekly', 'Bi-Weekly', 'Monthly', 'Monthly (Last Day)']),
    transferTo: z.string().optional(),
    transferFrom: z.string().optional(),
    destinationAccountId: z.string().optional(),
    forNextMonth: z.boolean().optional(),
    budgetCategoryId: z.string().optional(),
    // New fields for allocation
    allocationType: z.enum(['none', 'goal', 'debt']).default('none'),
    allocationTargetId: z.string().optional(),
    allocationAmount: z.coerce.number().optional(),
    splits: z.array(z.object({
      type: z.enum(['expense', 'transfer']),
      amount: z.coerce.number().min(0.01, 'Amount must be greater than 0.'),
      categoryId: z.string().optional(),
      budgetItemName: z.string().optional(),
      destinationAccountId: z.string().optional(),
    })).optional(),
  }).refine(data => {
    if (data.type === 'Transfers') {
      return !!data.transferTo && !!data.transferFrom;
    }
    return true;
  }, {
    message: 'Both "Source" and "Destination" accounts are required for transfers.',
    path: ['transferTo'],
  }).refine(data => {
    if (data.type === 'Income') {
        return !!data.destinationAccountId;
    }
    return true;
  }, {
      message: 'Destination account is required for income.',
      path: ['destinationAccountId'],
  });

type BudgetFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addBudgetItem: (item: Omit<BudgetItem, 'id'>) => void;
  updateBudgetItem: (id: string, item: Omit<BudgetItem, 'id'>, updateType?: 'instance' | 'pattern') => void;
  editingItem: BudgetItem | null;
  month?: string;
};

export function BudgetForm({ open, onOpenChange, addBudgetItem, updateBudgetItem, editingItem, month }: BudgetFormProps) {
  const { categories: incomeCategories } = useIncomeCategories();
  const { categories: budgetCategories, budgetItems: monthlyBudgetItems } = useMonthlyBudget(month);
  const { accounts: transferees } = useAccountDetails();
  const { goals, fetchGoals } = useGoals();
  const { debts, fetchDebts } = useDebt();
  const [split, setSplit] = useState({ savings: 0, charity: 0, fun: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<any | null>(null);
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      category: '',
      amount: 0,
      type: 'Income',
      date: new Date().toISOString().split('T')[0],
      frequency: 'One-Time',
      transferFrom: '',
      transferTo: '',
      destinationAccountId: '',
      forNextMonth: false,
      budgetCategoryId: '',
      allocationType: 'none',
      allocationTargetId: '',
      allocationAmount: 0,
      splits: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'splits'
  });

  const itemType = form.watch('type');
  const category = form.watch('category');
  const amount = form.watch('amount');
  const allocationType = form.watch('allocationType');

  const showCalculator = itemType === 'Income' && category === 'Misc. Income';

  useEffect(() => {
    if (showCalculator) {
      const splitAmount = parseFloat((amount / 3).toFixed(2));
      setSplit({
        savings: splitAmount,
        charity: splitAmount,
        fun: splitAmount,
      });
      // Automatically set the allocation amount to the full savings portion
      if (form.getValues('allocationAmount') !== splitAmount) {
        form.setValue('allocationAmount', splitAmount);
      }
    } else {
      // Reset allocation when calculator is not shown
      if (form.getValues('allocationType') !== 'none') {
        form.setValue('allocationType', 'none');
      }
      if (form.getValues('allocationTargetId') !== '') {
        form.setValue('allocationTargetId', '');
      }
      if (form.getValues('allocationAmount') !== 0) {
        form.setValue('allocationAmount', 0);
      }
    }
  }, [amount, showCalculator, form]);
  
  useEffect(() => {
    if (open) {
      if (editingItem) {
        form.reset({
          description: editingItem.description,
          category: editingItem.category,
          amount: editingItem.amount,
          type: editingItem.type,
          date: editingItem.date.split('T')[0],
          frequency: editingItem.frequency || 'One-Time',
          transferFrom: editingItem.transferFrom || '',
          transferTo: editingItem.transferTo || '',
          destinationAccountId: editingItem.destinationAccountId || '',
          forNextMonth: editingItem.forNextMonth || false,
          budgetCategoryId: editingItem.budgetCategoryId || '',
          allocationType: 'none',
          allocationTargetId: '',
          allocationAmount: 0,
          splits: editingItem.splits || [],
        });
      } else {
        form.reset({
          description: '',
          category: '',
          amount: 0,
          type: 'Income',
          date: new Date().toISOString().split('T')[0],
          frequency: 'One-Time',
          transferFrom: '',
          transferTo: '',
          destinationAccountId: '',
          forNextMonth: false,
          budgetCategoryId: '',
          allocationType: 'none',
          allocationTargetId: '',
          allocationAmount: 0,
          splits: [],
        });
      }
    }
  }, [editingItem, open, form]);

  useEffect(() => {
    if (itemType !== 'Income') {
      if (form.getValues('category') !== 'N/A') form.setValue('category', 'N/A');
      if (form.getValues('destinationAccountId') !== undefined) form.setValue('destinationAccountId', undefined);
      if (form.getValues('forNextMonth') !== false) form.setValue('forNextMonth', false);
    } else {
      const currentCategory = form.getValues('category');
      if (currentCategory === 'N/A') {
        form.setValue('category', '');
      }
    }
    if (itemType !== 'Transfers') {
      if (form.getValues('transferFrom') !== undefined) form.setValue('transferFrom', undefined);
      if (form.getValues('transferTo') !== undefined) form.setValue('transferTo', undefined);
    }
    if (itemType !== 'Pre-Authorized Payments') {
      if (form.getValues('budgetCategoryId') !== undefined) form.setValue('budgetCategoryId', undefined);
    }
  }, [itemType, form]);


  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);

    if (values.type === 'Transfers' && values.splits && values.splits.length > 0) {
      const splitsSum = values.splits.reduce((sum, s) => sum + (s.amount || 0), 0);
      if (Math.abs(splitsSum - values.amount) > 0.01) {
        toast({
          title: 'Error',
          description: 'The sum of the splits must equal the total transfer amount.',
          variant: 'destructive',
        });
        setIsSubmitting(false);
        return;
      }
    }

    const submissionData = {
      ...values,
      type: values.type as BudgetItemType,
      frequency: values.frequency as BudgetItemFrequency,
      budgetCategoryId: values.budgetCategoryId === 'null-value' ? null : values.budgetCategoryId,
      splits: values.type === 'Transfers' ? values.splits : undefined
    };
    
    // Handle allocation logic
    if (showCalculator && values.allocationType !== 'none' && values.allocationTargetId && values.allocationAmount && values.allocationAmount > 0) {
        try {
            const { allocationType, allocationTargetId, allocationAmount } = values;
            if (allocationType === 'goal') {
                const goalToUpdate = goals.find(g => g.id === allocationTargetId);
                if (goalToUpdate) {
                    await GoalService.addToGoal(allocationTargetId, allocationAmount);
                    toast({
                        title: 'Goal Updated!',
                        description: `${formatCurrency(allocationAmount)} was added to "${goalToUpdate.name}".`
                    });
                    await fetchGoals();
                }
            } else if (allocationType === 'debt') {
                const debtToUpdate = debts.find(d => d.id === allocationTargetId);
                 if (debtToUpdate) {
                    await DebtService.addExtraPayment(allocationTargetId, values.date.substring(0, 7), allocationAmount);
                    toast({
                        title: 'Debt Updated!',
                        description: `An extra payment of ${formatCurrency(allocationAmount)} was made to "${debtToUpdate.name}".`
                    });
                    await fetchDebts();
                 }
            }
        } catch (error) {
             console.error("Failed to allocate funds:", error);
             toast({
                title: 'Allocation Error',
                description: 'Could not allocate the funds as requested.',
                variant: 'destructive',
            });
        }
    }


    if (editingItem && editingItem.id.includes('-')) {
      setPendingUpdate(submissionData);
    } else {
      if (editingItem) {
        updateBudgetItem(editingItem.id, submissionData);
      } else {
        addBudgetItem(submissionData);
      }
      setIsSubmitting(false);
      onOpenChange(false);
    }
  }

  const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const getBreakdownOptions = (categoryId: string) => {
    const budgetItem = monthlyBudgetItems.find((b: any) => b.categoryId === categoryId);
    return budgetItem?.breakdown?.filter((b: any) => b.name !== 'Default') || [];
  };

  const categoryTree = useMemo(() => {
    const buildTree = (parentId: string | null = null): CategoryWithChildren[] => {
        return budgetCategories
            .filter(c => c.parentId === parentId)
            .map(c => ({
                ...c,
                children: buildTree(c.id),
            }));
    }
    return buildTree(null);
  }, [budgetCategories]);

  const renderCategoryOptions = (nodes: CategoryWithChildren[], level = 0) => {
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Item' : 'Add New Item'}</DialogTitle>
          <DialogDescription>
            {editingItem ? 'Update the details for your budget item.' : 'Fill in the details for your new budget item.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ScrollArea className="h-[60vh] pr-6 -mr-6">
                <div className="space-y-4">
                    <FormField control={form.control} name="type" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select item type" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            <SelectItem value="Income">Income</SelectItem>
                            <SelectItem value="Debt Payments">Debt Payments</SelectItem>
                            <SelectItem value="Transfers">Transfers</SelectItem>
                            <SelectItem value="Pre-Authorized Payments">Pre-Authorized Payments</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField control={form.control} name="description" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl><Input placeholder="e.g., Monthly Salary" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    {itemType === 'Income' && (
                        <>
                            <FormField control={form.control} name="category" render={({ field }) => (
                                <FormItem>
                                <FormLabel>Category</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                    <FormControl>
                                        <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {incomeCategories.map(category => (
                                        <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                    </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField control={form.control} name="destinationAccountId" render={({ field }) => (
                                <FormItem>
                                <FormLabel>Destination Account</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select destination account" /></SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {transferees.filter(t => t.type !== 'Credit').map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                                control={form.control}
                                name="forNextMonth"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel>For Next Month's Budget</FormLabel>
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
                        </>
                    )}
                    <FormField control={form.control} name="amount" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />

                    {showCalculator && (
                        <Card className="bg-secondary/50">
                            <CardHeader className="p-4">
                                <CardTitle className="text-base">Found Money: Split & Allocate</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0 text-sm space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Charity:</span>
                                        <span className="font-medium">{formatCurrency(split.charity)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Fun:</span>
                                        <span className="font-medium">{formatCurrency(split.fun)}</span>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <Label>Allocate Savings/Debt Portion ({formatCurrency(split.savings)})</Label>
                                    <FormField
                                        control={form.control}
                                        name="allocationType"
                                        render={({ field }) => (
                                            <FormItem>
                                            <FormControl>
                                                <RadioGroup
                                                onValueChange={field.onChange}
                                                value={field.value}
                                                className="flex gap-4"
                                                >
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><RadioGroupItem value="goal" /></FormControl>
                                                        <FormLabel className="font-normal">Goal</FormLabel>
                                                    </FormItem>
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><RadioGroupItem value="debt" /></FormControl>
                                                        <FormLabel className="font-normal">Debt</FormLabel>
                                                    </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    {allocationType !== 'none' && (
                                        <div className="flex gap-2">
                                            <FormField
                                                control={form.control}
                                                name="allocationTargetId"
                                                render={({ field }) => (
                                                    <FormItem className="flex-grow">
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder={`Select ${allocationType}`} />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {allocationType === 'goal' && goals.map(goal => (
                                                                    <SelectItem key={goal.id} value={goal.id}>{goal.name}</SelectItem>
                                                                ))}
                                                                {allocationType === 'debt' && debts.map(debt => (
                                                                    <SelectItem key={debt.id} value={debt.id}>{debt.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="allocationAmount"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormControl>
                                                            <Input 
                                                                type="number" 
                                                                step="0.01" 
                                                                {...field} 
                                                                className="w-28" 
                                                                placeholder="Amount"
                                                                onChange={(e) => {
                                                                    const value = e.target.value;
                                                                    field.onChange(value === '' ? '' : parseFloat(value) || 0);
                                                                }}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}


                    {itemType === 'Transfers' && (
                    <>
                        <FormField control={form.control} name="transferFrom" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Source Account</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select a source" /></SelectTrigger>
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
                        <FormField control={form.control} name="transferTo" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Destination Account</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Select a destination" /></SelectTrigger>
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

                        <Separator className="my-4" />
                        
                        <div className="flex justify-between items-center mb-2">
                            <Label className="text-sm font-semibold">Transfer Splits (Sub-categories)</Label>
                        </div>

                        {fields.length > 0 && (
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                {fields.map((fieldItem, index) => {
                                    const split = form.watch(`splits.${index}`);
                                    if (!split) return null;
                                    const breakdownOptions = getBreakdownOptions(split.categoryId || '');
                                    
                                    return (
                                        <Card key={fieldItem.id} className="bg-secondary/30 border">
                                            <CardHeader className="p-2 flex flex-row items-center justify-between space-y-0">
                                                <CardTitle className="text-xs font-semibold text-primary">{split.type === 'expense' ? 'Expense Split' : 'Transfer Split'}</CardTitle>
                                                <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:bg-destructive/10" onClick={() => remove(index)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </CardHeader>
                                            <CardContent className="p-2 pt-0 grid gap-2">
                                                <FormField control={form.control} name={`splits.${index}.amount`} render={({ field }) => (
                                                    <FormItem className="space-y-1">
                                                        <FormLabel className="text-[10px]">Amount</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" step="0.01" className="h-8 text-xs" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}/>

                                                {split.type === 'expense' && (
                                                    <>
                                                        <FormField control={form.control} name={`splits.${index}.categoryId`} render={({ field }) => {
                                                            const [searchQuery, setSearchQuery] = useState('');
                                                            const [isOpen, setIsOpen] = useState(false);
                                                            
                                                            const flatCategories = useMemo(() => {
                                                                const flatten = (nodes: CategoryWithChildren[], parentName = ''): { id: string; fullName: string; isSubItem: boolean; subItemName?: string }[] => {
                                                                    let list: { id: string; fullName: string; isSubItem: boolean; subItemName?: string }[] = [];
                                                                    nodes.forEach(node => {
                                                                        const fullName = parentName ? `${parentName} > ${node.name}` : node.name;
                                                                        
                                                                        const budgetItem = monthlyBudgetItems.find((b: any) => b.categoryId === node.id);
                                                                        const subItems = budgetItem?.breakdown?.filter((b: any) => b.name !== 'Default') || [];
                                                                        
                                                                        if (subItems.length > 0) {
                                                                            subItems.forEach((sub: any) => {
                                                                                list.push({
                                                                                    id: node.id,
                                                                                    isSubItem: true,
                                                                                    subItemName: sub.name,
                                                                                    fullName: `${fullName} > ${sub.name}`
                                                                                });
                                                                            });
                                                                            list.push({ id: node.id, isSubItem: false, fullName });
                                                                        } else {
                                                                            list.push({ id: node.id, isSubItem: false, fullName });
                                                                        }
                                                                        
                                                                        if (node.children && node.children.length > 0) {
                                                                            list = list.concat(flatten(node.children, fullName));
                                                                        }
                                                                    });
                                                                    return list;
                                                                };
                                                                return flatten(categoryTree);
                                                            }, [categoryTree, monthlyBudgetItems]);

                                                            const filteredCategories = flatCategories.filter(cat => 
                                                                cat.fullName.toLowerCase().includes(searchQuery.toLowerCase())
                                                            );

                                                            const budgetItemName = form.watch(`splits.${index}.budgetItemName`) || '';
                                                            const selectedCategory = flatCategories.find(c => 
                                                                c.id === field.value && 
                                                                (budgetItemName ? (c.isSubItem && c.subItemName === budgetItemName) : !c.isSubItem)
                                                            );

                                                            return (
                                                                <FormItem className="space-y-1 flex flex-col w-full">
                                                                    <FormLabel className="text-[10px]">Category</FormLabel>
                                                                    <Popover open={isOpen} onOpenChange={setIsOpen}>
                                                                        <PopoverTrigger asChild>
                                                                            <FormControl>
                                                                                <Button
                                                                                    variant="outline"
                                                                                    role="combobox"
                                                                                    className={cn(
                                                                                        "h-8 text-xs justify-between font-normal w-full px-2 text-left",
                                                                                        !field.value && "text-muted-foreground"
                                                                                    )}
                                                                                >
                                                                                    <span className="truncate">{selectedCategory ? selectedCategory.fullName : "Select a category / sub-item"}</span>
                                                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                                                </Button>
                                                                            </FormControl>
                                                                        </PopoverTrigger>
                                                                        <PopoverContent className="w-[380px] p-2" align="start">
                                                                            <Input
                                                                                placeholder="Search categories and sub-items..."
                                                                                className="h-8 text-xs mb-2"
                                                                                value={searchQuery}
                                                                                onChange={e => setSearchQuery(e.target.value)}
                                                                            />
                                                                            <ScrollArea className="h-[200px] pr-1">
                                                                                {filteredCategories.length > 0 ? (
                                                                                    <div className="space-y-1">
                                                                                        {filteredCategories.map(cat => (
                                                                                            <button
                                                                                                key={cat.isSubItem ? `${cat.id}-${cat.subItemName}` : cat.id}
                                                                                                type="button"
                                                                                                className={cn(
                                                                                                    "w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent hover:text-accent-foreground transition-colors",
                                                                                                    field.value === cat.id && 
                                                                                                    (cat.isSubItem ? budgetItemName === cat.subItemName : !budgetItemName) && 
                                                                                                    "bg-accent font-medium text-accent-foreground"
                                                                                                )}
                                                                                                onClick={() => {
                                                                                                    field.onChange(cat.id);
                                                                                                    form.setValue(`splits.${index}.budgetItemName`, cat.isSubItem ? (cat.subItemName || '') : '');
                                                                                                    setIsOpen(false);
                                                                                                    setSearchQuery('');
                                                                                                }}
                                                                                            >
                                                                                                {cat.fullName}
                                                                                            </button>
                                                                                        ))}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="text-xs text-center py-4 text-muted-foreground">
                                                                                        No categories found.
                                                                                    </div>
                                                                                )}
                                                                            </ScrollArea>
                                                                        </PopoverContent>
                                                                    </Popover>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            );
                                                        }}/>
                                                        {breakdownOptions.length > 0 && (
                                                            <FormField control={form.control} name={`splits.${index}.budgetItemName`} render={({ field }) => (
                                                                <FormItem className="space-y-1">
                                                                    <FormLabel className="text-[10px]">Budget Sub-item</FormLabel>
                                                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                                                        <FormControl>
                                                                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select a sub-item" /></SelectTrigger>
                                                                        </FormControl>
                                                                        <SelectContent>
                                                                            {breakdownOptions.map((opt: any) => (
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
                                                        <FormItem className="space-y-1">
                                                            <FormLabel className="text-[10px]">Destination Account</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value || ''}>
                                                                <FormControl>
                                                                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select an account" /></SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {(() => {
                                                                        const myAccounts = transferees.filter(t => t.type !== 'IOU');
                                                                        const iouAccounts = transferees.filter(t => t.type === 'IOU');
                                                                        return (
                                                                            <>
                                                                                {myAccounts.length > 0 && (
                                                                                    <SelectGroup>
                                                                                        <SelectLabel className="text-[10px] font-bold text-muted-foreground px-2 py-1">My Accounts</SelectLabel>
                                                                                        {myAccounts.map(t => (
                                                                                            <SelectItem key={t.id} value={t.id}>{t.name} ({t.type})</SelectItem>
                                                                                        ))}
                                                                                    </SelectGroup>
                                                                                )}
                                                                                {iouAccounts.length > 0 && (
                                                                                    <SelectGroup>
                                                                                        <SelectLabel className="text-[10px] font-bold text-primary px-2 py-1">People / IOUs</SelectLabel>
                                                                                        {iouAccounts.map(t => (
                                                                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                                                                        ))}
                                                                                    </SelectGroup>
                                                                                )}
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}/>
                                                )}
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        )}

                        <div className="flex items-center gap-2 mt-3 justify-end">
                            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => append({ type: 'expense', amount: 0, categoryId: '', budgetItemName: '' })}>
                                <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add Expense Split
                            </Button>
                            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => append({ type: 'transfer', amount: 0, destinationAccountId: '' })}>
                                <PlusCircle className="mr-1.5 h-3.5 w-3.5" /> Add Transfer Split
                            </Button>
                        </div>

                        {form.watch('splits') && form.watch('splits')!.length > 0 && (() => {
                            const splits = form.watch('splits') || [];
                            const splitsSum = splits.reduce((sum, s) => sum + (s?.amount || 0), 0);
                            const remainingAmount = amount - splitsSum;
                            return (
                                <div className={cn("text-right text-xs font-semibold py-1 px-2 rounded mt-2 border bg-accent/25", Math.abs(remainingAmount) > 0.01 ? 'text-destructive' : 'text-green-600')}>
                                    {Math.abs(remainingAmount) > 0.01 
                                        ? `Amount left to assign: ${formatCurrency(remainingAmount)}`
                                        : 'All split amounts match the total!'
                                    }
                                </div>
                            );
                        })()}
                    </>
                    )}

                    {itemType === 'Pre-Authorized Payments' && (
                        <FormField
                            control={form.control}
                            name="budgetCategoryId"
                            render={({ field }) => {
                                const [searchQuery, setSearchQuery] = useState('');
                                const [isOpen, setIsOpen] = useState(false);
                                
                                const flatCategories = useMemo(() => {
                                    const flatten = (nodes: CategoryWithChildren[], parentName = ''): { id: string; fullName: string }[] => {
                                        let list: { id: string; fullName: string }[] = [];
                                        nodes.forEach(node => {
                                            const fullName = parentName ? `${parentName} > ${node.name}` : node.name;
                                            list.push({ id: node.id, fullName });
                                            if (node.children && node.children.length > 0) {
                                                list = list.concat(flatten(node.children, fullName));
                                            }
                                        });
                                        return list;
                                    };
                                    return flatten(categoryTree);
                                }, [categoryTree]);

                                const filteredCategories = flatCategories.filter(cat => 
                                    cat.fullName.toLowerCase().includes(searchQuery.toLowerCase())
                                );

                                const selectedCategory = flatCategories.find(c => c.id === field.value);

                                return (
                                    <FormItem className="space-y-1 flex flex-col w-full">
                                        <FormLabel>Budget Category (Optional)</FormLabel>
                                        <Popover open={isOpen} onOpenChange={setIsOpen}>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant="outline"
                                                        role="combobox"
                                                        className={cn(
                                                            "h-10 justify-between font-normal w-full px-3 text-left",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        <span className="truncate">{selectedCategory ? selectedCategory.fullName : (field.value === 'null-value' || !field.value ? "None" : "Select a category")}</span>
                                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[300px] p-2" align="start">
                                                <Input
                                                    placeholder="Search categories..."
                                                    className="h-8 text-xs mb-2"
                                                    value={searchQuery}
                                                    onChange={e => setSearchQuery(e.target.value)}
                                                />
                                                <ScrollArea className="h-[200px] pr-1">
                                                    <button
                                                        type="button"
                                                        className={cn(
                                                            "w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent hover:text-accent-foreground transition-colors",
                                                            (field.value === 'null-value' || !field.value) && "bg-accent font-medium text-accent-foreground"
                                                        )}
                                                        onClick={() => {
                                                            field.onChange('null-value');
                                                            setIsOpen(false);
                                                            setSearchQuery('');
                                                        }}
                                                    >
                                                        None
                                                    </button>
                                                    {filteredCategories.length > 0 && (
                                                        <div className="space-y-1 mt-1 pt-1 border-t">
                                                            {filteredCategories.map(cat => (
                                                                <button
                                                                    key={cat.id}
                                                                    type="button"
                                                                    className={cn(
                                                                        "w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent hover:text-accent-foreground transition-colors",
                                                                        field.value === cat.id && "bg-accent font-medium text-accent-foreground"
                                                                    )}
                                                                    onClick={() => {
                                                                        field.onChange(cat.id);
                                                                        setIsOpen(false);
                                                                        setSearchQuery('');
                                                                    }}
                                                                >
                                                                    {cat.fullName}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </ScrollArea>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                );
                            }}
                        />
                    )}

                    <FormField control={form.control} name="date" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField control={form.control} name="frequency" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Frequency</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            <SelectItem value="One-Time">One-Time</SelectItem>
                            <SelectItem value="Weekly">Weekly</SelectItem>
                            <SelectItem value="Bi-Weekly">Bi-Weekly</SelectItem>
                            <SelectItem value="Monthly">Monthly</SelectItem>
                            <SelectItem value="Monthly (Last Day)">Monthly (Last Day)</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
            </ScrollArea>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingItem ? 'Save Changes' : 'Add Item'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>

    <Dialog open={!!pendingUpdate} onOpenChange={(open) => !open && setPendingUpdate(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Recurring Item</DialogTitle>
          <DialogDescription>
            This is a recurring pre-authorized payment. Would you like to update only this specific instance, or the entire recurring series?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end mt-4">
          <Button variant="outline" onClick={() => setPendingUpdate(null)}>
            Cancel
          </Button>
          <Button variant="outline" onClick={async () => {
            if (pendingUpdate && editingItem) {
              await updateBudgetItem(editingItem.id, pendingUpdate, 'instance');
              setPendingUpdate(null);
              onOpenChange(false);
              setIsSubmitting(false);
            }
          }}>
            This Instance Only
          </Button>
          <Button variant="default" onClick={async () => {
            if (pendingUpdate && editingItem) {
              await updateBudgetItem(editingItem.id, pendingUpdate, 'pattern');
              setPendingUpdate(null);
              onOpenChange(false);
              setIsSubmitting(false);
            }
          }}>
            Entire Series
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
