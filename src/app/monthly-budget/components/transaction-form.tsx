'use client';

import { useEffect, useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray } from 'react-hook-form';
import * as z from 'zod';
import { Button, buttonVariants } from '@/components/ui/button';
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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, SelectLabel } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, User, Users, Info, Copy, Loader2, Handshake, Calculator as CalcIcon, Minus, Maximize2, Receipt, X, AlertTriangle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Calculator } from '@/components/calculator';
import type { Transaction, AccountDetails, Category, SavingsItem } from '@/types';
import { useMonthlyBudget } from '../hooks/use-monthly-budget';
import { cn, generateUUID } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCommonAccounts } from '@/hooks/use-common-accounts';
import { useFirestore } from '@/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { useFloatingCalculator } from '@/hooks/use-floating-calculator';

const SINKING_FUNDS_CATEGORY_ID = 'KbWSJVpQRZBOTmu8HxjI';

type CategoryWithChildren = Category & { children: CategoryWithChildren[] };

const splitSchema = z.object({
    id: z.string(),
    type: z.enum(['expense', 'transfer', 'income']),
    amount: z.coerce.number().min(0, 'Amount must be a positive number.'),
    categoryId: z.string().optional(),
    budgetItemName: z.string().optional(),
    destinationAccountId: z.string().optional(),
    sinkingFundId: z.string().optional(),
});

const formSchema = z.object({
  description: z.string().optional(),
  payee: z.string().optional(),
  amount: z.coerce.number().min(0.01, 'Amount must be greater than zero.'),
  date: z.string().min(1, 'A date is required.'),
  sourceAccountId: z.string().optional(),
  splits: z.array(splitSchema),
  isIOUPayment: z.boolean().optional(),
  paidById: z.string().optional(),
  isOpeningBalance: z.boolean().optional(),
}).refine(data => {
    const totalSplitAmount = data.splits.reduce((sum, split) => sum + split.amount, 0);
    return Math.abs(totalSplitAmount - data.amount) < 0.01; 
}, {
    message: 'The sum of the splits must equal the total transaction amount.',
    path: ['splits'],
}).refine(data => {
    if (data.isOpeningBalance) return true;
    if (data.isIOUPayment) return !!data.paidById;
    const hasOnlyIncome = data.splits.length > 0 && data.splits.every(s => s.type === 'income');
    if (hasOnlyIncome) return true;
    return !!data.sourceAccountId;
}, {
    message: 'A source account is required.',
    path: ['sourceAccountId'],
}).refine(data => {
    if (data.isOpeningBalance) return true;
    return !!data.description && data.description.length >= 2;
}, {
    message: 'Description must be at least 2 characters.',
    path: ['description'],
});

type TransactionFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: AccountDetails[];
  addTransaction: (item: Partial<Omit<Transaction, 'id'>>, isIOUPayment?: boolean) => Promise<void>;
  updateTransaction: (id: string, item: Partial<Omit<Transaction, 'id'>>) => Promise<void>;
  deleteTransaction: (id: string) => void;
  editingTransaction: Transaction | null;
  initialData?: Partial<Transaction> | null;
  month?: string;
  isPage?: boolean;
};

export function TransactionForm({ open, onOpenChange, accounts, addTransaction, updateTransaction, editingTransaction, initialData, month, isPage = false }: TransactionFormProps) {
  const { categories, budgetItems } = useMonthlyBudget(month);
  const { commonAccountIds } = useCommonAccounts();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [payeesList, setPayeesList] = useState<string[]>([]);
  const [sinkingFunds, setSinkingFunds] = useState<SavingsItem[]>([]);
  const db = useFirestore();

  // Floating calculator integration
  const setIsCalculatorOpen = useFloatingCalculator(state => state.setIsOpen);
  const setIsCalculatorMinimized = useFloatingCalculator(state => state.setIsMinimized);
  const setOnUseCalculatorResult = useFloatingCalculator(state => state.setOnUseResult);

  const handleOpenCalculator = (fieldName: 'amount' | `splits.${number}.amount` = 'amount') => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    
    setOnUseCalculatorResult((value) => {
      form.setValue(fieldName, parseFloat(value) || 0, { shouldValidate: true });
      setIsCalculatorOpen(false);
    });
    setIsCalculatorOpen(true);
    setIsCalculatorMinimized(false);
  };

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'payees'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data().name as string);
      setPayeesList(list);
    }, (error) => {
      console.error('Failed to load payees in form:', error);
    });
    return () => unsubscribe();
  }, [db]);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'sinking-funds'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSinkingFunds(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavingsItem)));
    }, (error) => {
      console.error('Failed to load sinking funds in form:', error);
    });
    return () => unsubscribe();
  }, [db]);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      payee: '',
      amount: 0,
      date: format(new Date(), 'yyyy-MM-dd'),
      sourceAccountId: '',
      splits: [],
      isIOUPayment: false,
      paidById: '',
      isOpeningBalance: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'splits',
  });
  
  const { commonAccounts, otherAccounts } = useMemo(() => {
    const common = accounts.filter(a => commonAccountIds.includes(a.id));
    const other = accounts.filter(a => !commonAccountIds.includes(a.id));
    return { commonAccounts: common, otherAccounts: other };
  }, [accounts, commonAccountIds]);

  const iouAccounts = useMemo(() => accounts.filter(a => a.type === 'IOU'), [accounts]);
  const isIOUPayment = form.watch('isIOUPayment');
  const isOpeningBalance = form.watch('isOpeningBalance');
  
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

  const getDefaultDate = () => {
    if (month) {
      const currentMonth = format(new Date(), 'yyyy-MM');
      if (month !== currentMonth) {
        return `${month}-01`;
      }
    }
    return format(new Date(), 'yyyy-MM-dd');
  };

  useEffect(() => {
    if (open) {
      setIsMinimized(false);
      if (editingTransaction) {
        const isIOU = !!editingTransaction.paidById;
        const isOpening = editingTransaction.description === 'Opening Balance' && (editingTransaction.splits || []).some(s => s.type === 'income');
        const splitsWithSF = (editingTransaction.splits || []).map(s => {
          let sfId = s.sinkingFundId;
          if (!sfId && s.budgetItemName) {
            const matched = sinkingFunds.find(sf => sf.name.trim().toLowerCase() === s.budgetItemName?.trim().toLowerCase());
            if (matched) sfId = matched.id;
          }
          return { ...s, sinkingFundId: sfId || '' };
        });
        form.reset({
          description: editingTransaction.description,
          payee: editingTransaction.payee || '',
          amount: editingTransaction.amount,
          date: editingTransaction.date.split('T')[0],
          sourceAccountId: isIOU ? '' : editingTransaction.sourceAccountId,
          splits: splitsWithSF,
          isIOUPayment: isIOU,
          paidById: isIOU ? editingTransaction.paidById : '',
          isOpeningBalance: isOpening,
        });
      } else if (initialData) {
        const initialAmount = initialData.amount ?? 0;
        const initialDate = initialData.date ? initialData.date.split('T')[0] : getDefaultDate();
        const splitsWithSF = (initialData.splits || []).map(s => {
          let sfId = s.sinkingFundId;
          if (!sfId && s.budgetItemName) {
            const matched = sinkingFunds.find(sf => sf.name.trim().toLowerCase() === s.budgetItemName?.trim().toLowerCase());
            if (matched) sfId = matched.id;
          }
          return { ...s, sinkingFundId: sfId || '' };
        });
        form.reset({
          description: initialData.description || '',
          payee: initialData.payee || initialData.description || '',
          amount: initialAmount,
          date: initialDate,
          sourceAccountId: initialData.sourceAccountId || '',
          splits: splitsWithSF,
          isIOUPayment: false,
          paidById: '',
          isOpeningBalance: false,
        });
      } else {
        // Check for saved draft in sessionStorage for new transactions
        let restoredDraft: any = null;
        if (typeof window !== 'undefined') {
          try {
            const raw = sessionStorage.getItem('tasktrack_tx_new_draft');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && ((parsed.amount || 0) > 0 || (parsed.description || '').trim() !== '' || (parsed.splits || []).length > 0)) {
                restoredDraft = parsed;
              }
            }
          } catch (e) {}
        }

        if (restoredDraft) {
          form.reset({
            description: restoredDraft.description || '',
            payee: restoredDraft.payee || '',
            amount: restoredDraft.amount || 0,
            date: restoredDraft.date || getDefaultDate(),
            sourceAccountId: restoredDraft.sourceAccountId || '',
            splits: restoredDraft.splits || [],
            isIOUPayment: restoredDraft.isIOUPayment || false,
            paidById: restoredDraft.paidById || '',
            isOpeningBalance: restoredDraft.isOpeningBalance || false,
          });
        } else {
          form.reset({
            description: '',
            payee: '',
            amount: 0,
            date: getDefaultDate(),
            sourceAccountId: '',
            splits: [],
            isIOUPayment: false,
            paidById: '',
            isOpeningBalance: false,
          });
        }
      }
    }
  }, [editingTransaction, initialData, open, form, month, sinkingFunds]);

  // Auto-save active new transaction draft to sessionStorage
  useEffect(() => {
    if (open && !editingTransaction && !initialData) {
      const subscription = form.watch((value) => {
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.setItem('tasktrack_tx_new_draft', JSON.stringify(value));
          } catch (e) {}
        }
      });
      return () => subscription.unsubscribe();
    }
  }, [open, editingTransaction, initialData, form]);

  const totalAmount = form.watch('amount');
  const splitAmounts = form.watch('splits');
  const hasOnlyIncome = splitAmounts.length > 0 && splitAmounts.every(s => s.type === 'income');

  useEffect(() => {
    if (isOpeningBalance) {
      form.setValue('splits.0.amount', totalAmount || 0, { shouldValidate: true });
    }
  }, [totalAmount, isOpeningBalance, form]);

  const remainingAmount = useMemo(() => {
    const totalSplit = splitAmounts.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    return totalAmount - totalSplit;
  }, [totalAmount, splitAmounts]);

  const handleAddSplit = (type: 'expense' | 'transfer' | 'income') => {
    append({
        id: generateUUID(),
        type,
        amount: remainingAmount > 0 ? remainingAmount : 0,
        categoryId: '',
        budgetItemName: '',
        destinationAccountId: '',
        sinkingFundId: '',
    });
  };

  const getBreakdownOptions = (categoryId: string) => {
    if (!categoryId) return [];

    const category = categories.find(c => c.id === categoryId);
    const categoryName = category?.name;
    const isSinkingFundsCategory = categoryId === SINKING_FUNDS_CATEGORY_ID || categoryName?.toLowerCase().trim() === 'sinking funds';

    if (isSinkingFundsCategory) {
      return sinkingFunds.map(sf => {
        const balFormatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: sf.currency || 'CAD',
        }).format(sf.amount || 0);
        const statusLabel = sf.status === 'inactive' ? ' [Inactive]' : '';
        return {
          name: sf.name,
          sinkingFundId: sf.id,
          label: `${sf.name} (Balance: ${balFormatted})${statusLabel}`,
          isSinkingFund: true,
        };
      });
    }

    const relatedCategoryIds = new Set<string>([categoryId]);
    const relatedCategoryNames = new Set<string>();
    if (categoryName) relatedCategoryNames.add(categoryName);

    const childCats = categories.filter(c => c.parentId === categoryId);
    childCats.forEach(child => {
      relatedCategoryIds.add(child.id);
      relatedCategoryNames.add(child.name);
    });

    const optionsMap = new Map<string, { name: string; label?: string; sinkingFundId?: string; isSinkingFund?: boolean }>();

    budgetItems.forEach((b: any) => {
      const matchesId = b.categoryId && relatedCategoryIds.has(b.categoryId);
      const matchesName = b.category && relatedCategoryNames.has(b.category);

      if (matchesId || matchesName) {
        if (Array.isArray(b.breakdown) && b.breakdown.length > 0) {
          b.breakdown.forEach((sub: any) => {
            if (sub && sub.name && !optionsMap.has(sub.name)) {
              optionsMap.set(sub.name, { name: sub.name, label: sub.name });
            }
          });
        }
      }
    });

    childCats.forEach(child => {
      if (!optionsMap.has(child.name)) {
        optionsMap.set(child.name, { name: child.name, label: child.name });
      }
    });

    return Array.from(optionsMap.values());
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    let finalSplits = values.splits.map(split => {
      let sfId = split.sinkingFundId;
      if (!sfId && split.budgetItemName) {
        const matched = sinkingFunds.find(sf => sf.name.trim().toLowerCase() === split.budgetItemName?.trim().toLowerCase());
        if (matched) sfId = matched.id;
      }
      if (split.type === 'expense') {
        return { ...split, destinationAccountId: undefined, sinkingFundId: sfId || undefined };
      }
      return { ...split, sinkingFundId: undefined };
    });

    if (values.isOpeningBalance) {
      finalSplits = [{
        id: values.splits[0]?.id || generateUUID(),
        type: 'income' as const,
        amount: values.amount,
        destinationAccountId: values.splits[0]?.destinationAccountId || '',
        sinkingFundId: undefined,
      }];
    }

    const hasOnlyIncome = finalSplits.length > 0 && finalSplits.every(s => s.type === 'income');

    const submissionData = { 
        description: values.isOpeningBalance ? 'Opening Balance' : values.description || '',
        payee: values.isOpeningBalance ? '' : values.payee,
        amount: values.amount,
        date: values.date,
        sourceAccountId: (values.isIOUPayment || values.isOpeningBalance || hasOnlyIncome) ? undefined : values.sourceAccountId,
        paidById: values.isIOUPayment ? values.paidById : undefined,
        splits: finalSplits,
    };

    try {
        if (editingTransaction) {
          await updateTransaction(editingTransaction.id, submissionData);
        } else {
          await addTransaction(submissionData, values.isIOUPayment);
        }
        if (typeof window !== 'undefined') {
          try {
            sessionStorage.removeItem('tasktrack_tx_new_draft');
          } catch (e) {}
        }
        setIsMinimized(false);
        toast({ title: "Success", description: "Transaction saved." });
        onOpenChange(false);
    } catch (error) {
        toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }

  const isFormDirty = () => {
    const values = form.getValues();
    const hasDesc = (values.description || '').trim().length > 0;
    const hasPayee = (values.payee || '').trim().length > 0;
    const hasAmount = (values.amount || 0) > 0;
    const hasSplits = (values.splits || []).some(s => (s.amount || 0) > 0 || (s.categoryId || '') !== '');
    return hasDesc || hasPayee || hasAmount || hasSplits;
  };

  const handleRequestClose = () => {
    if (isFormDirty()) {
      setShowDiscardConfirm(true);
    } else {
      handleConfirmDiscard();
    }
  };

  const handleConfirmDiscard = () => {
    setShowDiscardConfirm(false);
    setIsMinimized(false);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.removeItem('tasktrack_tx_new_draft');
      } catch (e) {}
    }
    form.reset({
      description: '',
      payee: '',
      amount: 0,
      date: getDefaultDate(),
      sourceAccountId: '',
      splits: [],
      isIOUPayment: false,
      paidById: '',
      isOpeningBalance: false,
    });
    onOpenChange(false);
  };

  const handleUseCalculatorResult = (index: number) => (result: string) => {
    form.setValue(`splits.${index}.amount`, parseFloat(result), { shouldValidate: true });
  }

  const copyDescriptionToSplits = () => {
    const description = form.getValues('description');
    if (description) {
        toast({ title: "Copied!", description: "Description applied to all splits." });
    }
  }

  const renderCategoryOptions = (nodes: CategoryWithChildren[], level = 0): JSX.Element[] => {
    let options: JSX.Element[] = [];
    nodes.forEach(node => {
        options.push(
            <SelectItem key={node.id} value={node.id} style={{ paddingLeft: `${1 + level * 1.5}rem` }}>
                {node.name}
            </SelectItem>
        );
        if (node.children.length > 0) {
            options = options.concat(renderCategoryOptions(node.children, level + 1));
        }
    });
    return options;
  };
  
  const renderAccountOptions = () => (
    <>
        {commonAccounts.length > 0 && (
            <SelectGroup>
                <SelectLabel>Commonly Used</SelectLabel>
                {commonAccounts.map(acc => (<SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>))}
            </SelectGroup>
        )}
        {otherAccounts.length > 0 && (
             <SelectGroup>
                <SelectLabel>Other</SelectLabel>
                {otherAccounts.map(acc => (<SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>))}
            </SelectGroup>
        )}
    </>
  );

  const formContent = (
    <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 h-full flex flex-col">
          <ScrollArea className={cn(isPage ? "flex-grow" : "h-[65vh] pr-4")}>
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    {!isOpeningBalance && (
                        <FormField
                            control={form.control}
                            name="isIOUPayment"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel className="flex items-center gap-2">
                                            <Handshake className="h-5 w-5" />
                                            <span>Paid by IOU</span>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button type="button" variant="ghost" className="h-6 w-6 p-0 hover:bg-transparent text-muted-foreground hover:text-primary">
                                                        <Info className="h-4 w-4" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-80" side="top" align="start">
                                                    <h4 className="font-semibold leading-none mb-2 text-primary">Splitwise / IOU Guide</h4>
                                                    <div className="text-xs text-muted-foreground space-y-2">
                                                        <div>
                                                            <h5 className="font-semibold text-foreground">If You Paid (Partner owes half):</h5>
                                                            <p className="pl-1">1. Keep this switch <b>OFF</b>.</p>
                                                            <p className="pl-1">2. Select the card/account you paid with.</p>
                                                            <p className="pl-1">3. Enter the <b>full transaction amount</b>.</p>
                                                            <p className="pl-1">4. Add 2 splits:</p>
                                                            <p className="pl-2">• <b>Expense:</b> Your half (e.g. Groceries).</p>
                                                            <p className="pl-2">• <b>Transfer:</b> Partner's half (Destination: <b>Splitwise</b>).</p>
                                                        </div>
                                                        <div className="pt-1 border-t">
                                                            <h5 className="font-semibold text-foreground">If Your Partner Paid (You owe half):</h5>
                                                            <p className="pl-1">1. Turn this switch <b>ON</b>.</p>
                                                            <p className="pl-1">2. Set "Paid By" to <b>Splitwise</b>.</p>
                                                            <p className="pl-1">3. Enter <b>your half of the cost</b> as the total.</p>
                                                            <p className="pl-1">4. Select the category for the expense.</p>
                                                        </div>
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </FormLabel>
                                    </div>
                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                </FormItem>
                            )}
                        />
                    )}
                    {!isIOUPayment && (
                        <FormField
                            control={form.control}
                            name="isOpeningBalance"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel className="flex items-center gap-2">
                                            <Info className="h-5 w-5" />
                                            <span>Opening Balance</span>
                                        </FormLabel>
                                    </div>
                                    <FormControl>
                                        <Switch 
                                            checked={field.value} 
                                            onCheckedChange={(checked) => {
                                                field.onChange(checked);
                                                if (checked) {
                                                    form.setValue('isIOUPayment', false);
                                                    form.setValue('sourceAccountId', '');
                                                    form.setValue('description', 'Opening Balance');
                                                    form.setValue('splits', [{
                                                        id: Math.random().toString(36).substring(2, 9),
                                                        type: 'income',
                                                        amount: form.getValues('amount') || 0,
                                                        destinationAccountId: ''
                                                    }]);
                                                } else {
                                                    form.setValue('description', '');
                                                    form.setValue('splits', []);
                                                }
                                            }} 
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="date" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Date</FormLabel>
                        <FormControl><Input type="date" {...field} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    {isOpeningBalance ? (
                        <FormField control={form.control} name="splits.0.destinationAccountId" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Account</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {renderAccountOptions()}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}/>
                    ) : isIOUPayment ? (
                        <FormField control={form.control} name="paidById" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Paid By</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select who paid" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {iouAccounts.map(acc => (<SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}/>
                    ) : hasOnlyIncome ? null : (
                        <FormField control={form.control} name="sourceAccountId" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Source Account</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                    <FormControl><SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {renderAccountOptions()}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}/>
                    )}
                </div>
                 <FormField control={form.control} name="amount" render={({ field }) => (
                     <FormItem>
                     <FormLabel>Total Transaction Amount</FormLabel>
                     <div className="relative flex rounded-md shadow-sm w-full">
                         <FormControl>
                             <Input type="number" step="0.01" {...field} className="pr-10" />
                         </FormControl>
                         <Button
                             type="button"
                             variant="ghost"
                             size="icon"
                             onClick={() => handleOpenCalculator('amount')}
                             className="absolute right-1 top-1 h-8 w-8 text-muted-foreground hover:text-primary hover:bg-transparent"
                         >
                             <CalcIcon className="h-4 w-4" />
                         </Button>
                     </div>
                     <FormMessage />
                     </FormItem>
                 )}/>
                {!isOpeningBalance && (
                    <>
                         <FormField control={form.control} name="payee" render={({ field }) => (
                             <FormItem>
                                 <FormLabel>Payee</FormLabel>
                                 <FormControl>
                                     <>
                                         <Input 
                                             list="payees-list"
                                             placeholder="Enter payee (e.g. Walmart, landlord)..."
                                             {...field}
                                         />
                                         <datalist id="payees-list">
                                             {payeesList.map(p => (
                                                 <option key={p} value={p} />
                                             ))}
                                         </datalist>
                                     </>
                                 </FormControl>
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
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                            <h4 className="font-medium">Transaction Splits</h4>
                            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                <Button type="button" variant="outline" size="sm" onClick={() => handleAddSplit('expense')} className="flex-1 sm:flex-initial justify-center">
                                    <User className="mr-2 h-4 w-4" /> Expense
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => handleAddSplit('transfer')} className="flex-1 sm:flex-initial justify-center">
                                    <Users className="mr-2 h-4 w-4" /> Transfer
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => handleAddSplit('income')} className="flex-1 sm:flex-initial justify-center">
                                    <Handshake className="mr-2 h-4 w-4" /> Income
                                </Button>
                            </div>
                        </div>
                    </>
                )}

                {!isOpeningBalance && (
                    <div className="space-y-3">
                        {fields.map((field, index) => {
                            const split = form.watch(`splits.${index}`);
                            const rawBreakdownOptions = getBreakdownOptions(split.categoryId || '');
                            const currentBudgetItemName = form.watch(`splits.${index}.budgetItemName`);

                            const breakdownOptions = [...rawBreakdownOptions];
                            if (currentBudgetItemName && !breakdownOptions.some(opt => opt.name === currentBudgetItemName)) {
                              breakdownOptions.unshift({ name: currentBudgetItemName });
                            }
                            
                            return (
                                <Card key={field.id} className="bg-secondary/50">
                                    <CardHeader className="p-3 flex flex-row items-center justify-between">
                                        <CardTitle className="text-base">{split.type === 'expense' ? 'Expense' : split.type === 'transfer' ? 'Transfer' : 'Income'}</CardTitle>
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
                                                <div className="relative flex rounded-md shadow-sm w-full">
                                                    <FormControl>
                                                        <Input type="number" step="0.01" {...field} className="pr-10" />
                                                    </FormControl>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleOpenCalculator(`splits.${index}.amount` as const)}
                                                        className="absolute right-1 top-1 h-8 w-8 text-muted-foreground hover:text-primary hover:bg-transparent"
                                                    >
                                                        <CalcIcon className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <FormMessage />
                                            </FormItem>
                                        )}/>
                                          {(split.type === 'expense' || split.type === 'transfer' || split.type === 'income') && (
                                            <>
                                               <FormField control={form.control} name={`splits.${index}.categoryId`} render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Category</FormLabel>
                                                        <Select 
                                                            onValueChange={(val) => {
                                                                field.onChange(val);
                                                                form.setValue(`splits.${index}.budgetItemName`, '');
                                                                form.setValue(`splits.${index}.sinkingFundId`, '');
                                                            }} 
                                                            value={field.value} 
                                                            defaultValue={field.value}
                                                        >
                                                            <FormControl>
                                                            <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {categoryTree.map(node => (
                                                                    <SelectGroup key={node.id}>
                                                                        <SelectItem value={node.id} className="font-semibold">{node.name}</SelectItem>
                                                                        {renderCategoryOptions(node.children, 1)}
                                                                    </SelectGroup>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                               )}/>
                                               {breakdownOptions.length > 0 && (
                                                    <FormField control={form.control} name={`splits.${index}.budgetItemName`} render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Budget Item</FormLabel>
                                                            <Select 
                                                                onValueChange={(val) => {
                                                                    field.onChange(val);
                                                                    const selectedOpt = breakdownOptions.find((opt: any) => opt.name === val);
                                                                    if (selectedOpt?.sinkingFundId) {
                                                                        form.setValue(`splits.${index}.sinkingFundId`, selectedOpt.sinkingFundId);
                                                                    } else {
                                                                        const sfMatch = sinkingFunds.find(sf => sf.name === val);
                                                                        if (sfMatch && (split.categoryId === SINKING_FUNDS_CATEGORY_ID || categories.find(c => c.id === split.categoryId)?.name?.toLowerCase().trim() === 'sinking funds')) {
                                                                            form.setValue(`splits.${index}.sinkingFundId`, sfMatch.id);
                                                                        } else {
                                                                            form.setValue(`splits.${index}.sinkingFundId`, '');
                                                                        }
                                                                    }
                                                                }} 
                                                                value={field.value} 
                                                                defaultValue={field.value}
                                                            >
                                                                <FormControl>
                                                                <SelectTrigger><SelectValue placeholder="Select a specific item" /></SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    {breakdownOptions.map((opt: any) => (
                                                                        <SelectItem key={opt.sinkingFundId ? `sf-${opt.sinkingFundId}` : opt.name} value={opt.name}>
                                                                            {opt.label || opt.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}/>
                                               )}
                                            </>
                                          )}
                                          {(split.type === 'transfer' || split.type === 'income') && (
                                              <FormField control={form.control} name={`splits.${index}.destinationAccountId`} render={({ field }) => (
                                                <FormItem>
                                                <FormLabel>Destination Account</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                                    <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {renderAccountOptions()}
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
                )}
                {!isOpeningBalance && (
                    <div className={cn("text-right text-sm font-medium sticky bottom-0 bg-background/80 backdrop-blur-sm py-1 rounded-md", remainingAmount < 0 ? 'text-destructive' : 'text-muted-foreground')}>
                       Amount left to assign: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(remainingAmount)}
                    </div>
                )}
            </div>
          </ScrollArea>
           <DialogFooter className={cn(isPage && "mt-auto")}>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingTransaction ? 'Save Changes' : 'Add Transaction'}
              </Button>
            </DialogFooter>
        </form>
    </Form>
  )
  
  if (isPage) return formContent;

  return (
    <>
      <Dialog 
        open={open && !isMinimized} 
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            handleRequestClose();
          } else {
            onOpenChange(true);
          }
        }}
      >
        <DialogContent 
          className="sm:max-w-xl max-h-[90vh] flex flex-col"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            handleRequestClose();
          }}
        >
          <DialogHeader className="pr-12 relative">
            <div className="flex items-center justify-between">
              <DialogTitle>{editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}</DialogTitle>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-8 top-0 h-8 w-8 text-muted-foreground hover:text-foreground rounded-sm"
                onClick={() => {
                  setIsMinimized(true);
                  toast({ title: "Transaction Minimized", description: "Click the floating widget at the bottom right to resume." });
                }}
                title="Minimize Form"
              >
                <Minus className="h-4 w-4" />
                <span className="sr-only">Minimize</span>
              </Button>
            </div>
            <DialogDescription>
              Enter transaction details and split it across categories or transfers.
            </DialogDescription>
          </DialogHeader>
          {formContent}
        </DialogContent>
      </Dialog>

      {/* Minimized floating widget */}
      {open && isMinimized && (
        <div
          className="fixed bottom-20 right-6 sm:bottom-6 sm:right-24 z-[9990] flex items-center gap-2.5 bg-background/95 backdrop-blur-md border border-primary/40 shadow-2xl rounded-full pl-4 pr-2.5 py-2 text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-200 hover:border-primary transition-all cursor-pointer select-none group"
          onClick={() => setIsMinimized(false)}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
            </span>
            <Receipt className="h-4 w-4 text-primary" />
            <span className="text-foreground font-medium max-w-[150px] sm:max-w-[220px] truncate">
              {form.watch('description') || (editingTransaction ? 'Editing Transaction' : 'New Transaction')}
            </span>
            <span className="font-semibold text-primary ml-1">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(form.watch('amount') || 0)}
            </span>
          </div>
          <div className="flex items-center gap-1 ml-1 border-l pl-2 border-border">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(false);
              }}
              title="Maximize Transaction Form"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                handleRequestClose();
              }}
              title="Close / Discard"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Discard Confirmation Dialog */}
      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Unsaved Transaction
            </AlertDialogTitle>
            <AlertDialogDescription>
              You have entered transaction details that haven&apos;t been saved yet. You can minimize this form to keep your changes while you browse, or discard them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setShowDiscardConfirm(false)}>
              Keep Editing
            </AlertDialogCancel>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => { 
                setShowDiscardConfirm(false); 
                setIsMinimized(true); 
                toast({ title: "Transaction Minimized", description: "Click the floating widget at the bottom right to resume." });
              }}
            >
              <Minus className="mr-1.5 h-4 w-4" />
              Minimize
            </Button>
            <AlertDialogAction 
              onClick={handleConfirmDiscard} 
              className={cn(buttonVariants({ variant: "destructive" }))}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}