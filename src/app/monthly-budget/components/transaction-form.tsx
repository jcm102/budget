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
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, SelectLabel } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, User, Users, Info, Copy, Loader2, Handshake } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Calculator } from '@/components/calculator';
import type { Transaction, AccountDetails, Category } from '@/types';
import { useMonthlyBudget } from '../hooks/use-monthly-budget';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCommonAccounts } from '@/hooks/use-common-accounts';
import { useFirestore } from '@/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

type CategoryWithChildren = Category & { children: CategoryWithChildren[] };

const splitSchema = z.object({
    id: z.string(),
    type: z.enum(['expense', 'transfer', 'income']),
    amount: z.coerce.number().min(0, 'Amount must be a positive number.'),
    categoryId: z.string().optional(),
    budgetItemName: z.string().optional(),
    destinationAccountId: z.string().optional(),
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
  isPage?: boolean;
};

export function TransactionForm({ open, onOpenChange, accounts, addTransaction, updateTransaction, editingTransaction, isPage = false }: TransactionFormProps) {
  const { categories, budgetItems } = useMonthlyBudget();
  const { commonAccountIds } = useCommonAccounts();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [payeesList, setPayeesList] = useState<string[]>([]);
  const db = useFirestore();

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
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      payee: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
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

  useEffect(() => {
    if (open) {
      if (editingTransaction) {
        const isIOU = !!editingTransaction.paidById;
        const isOpening = editingTransaction.description === 'Opening Balance' && (editingTransaction.splits || []).some(s => s.type === 'income');
        form.reset({
          description: editingTransaction.description,
          payee: editingTransaction.payee || '',
          amount: editingTransaction.amount,
          date: editingTransaction.date.split('T')[0],
          sourceAccountId: isIOU ? '' : editingTransaction.sourceAccountId,
          splits: editingTransaction.splits || [],
          isIOUPayment: isIOU,
          paidById: isIOU ? editingTransaction.paidById : '',
          isOpeningBalance: isOpening,
        });
      } else {
        form.reset({
          description: '',
          payee: '',
          amount: 0,
          date: new Date().toISOString().split('T')[0],
          sourceAccountId: '',
          splits: [],
          isIOUPayment: false,
          paidById: '',
          isOpeningBalance: false,
        });
      }
    }
  }, [editingTransaction, open, form]);

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
        id: crypto.randomUUID(),
        type,
        amount: remainingAmount > 0 ? remainingAmount : 0,
        categoryId: '',
        budgetItemName: '',
        destinationAccountId: '',
    });
  };

  const getBreakdownOptions = (categoryId: string) => {
    const budgetItem = budgetItems.find((b: any) => b.categoryId === categoryId);
    return budgetItem?.breakdown?.filter((b: any) => b.name !== 'Default') || [];
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    let finalSplits = values.splits.map(split => {
      if (split.type === 'expense') {
        return { ...split, destinationAccountId: undefined };
      }
      return split;
    });

    if (values.isOpeningBalance) {
      finalSplits = [{
        id: values.splits[0]?.id || crypto.randomUUID(),
        type: 'income' as const,
        amount: values.amount,
        destinationAccountId: values.splits[0]?.destinationAccountId || '',
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
        toast({ title: "Success", description: "Transaction saved." });
        onOpenChange(false);
    } catch (error) {
        toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }

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
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
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
                        <div className="flex justify-between items-center">
                            <h4 className="font-medium">Transaction Splits</h4>
                            <div className="flex items-center gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => handleAddSplit('expense')}>
                                    <User className="mr-2 h-4 w-4" /> Expense
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => handleAddSplit('transfer')}>
                                    <Users className="mr-2 h-4 w-4" /> Transfer
                                </Button>
                                <Button type="button" variant="outline" size="sm" onClick={() => handleAddSplit('income')}>
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
                            const breakdownOptions = getBreakdownOptions(split.categoryId || '');
                            
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
                                                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                                <FormMessage />
                                            </FormItem>
                                         )}/>
                                          {(split.type === 'expense' || split.type === 'transfer' || split.type === 'income') && (
                                            <>
                                               <FormField control={form.control} name={`splits.${index}.categoryId`} render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Category</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
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
                                                            <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                                                <FormControl>
                                                                <SelectTrigger><SelectValue placeholder="Select a specific item" /></SelectTrigger>
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