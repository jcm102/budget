
'use client';

import { useEffect, useState, useRef } from 'react';
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
import type { Expense, MileageLog, Honorarium, BudgetItemFrequency, TripType, UploadableFile } from '@/types';
import { useWorkCategories } from '@/hooks/use-work-categories';
import { useAccountDetails } from '@/hooks/use-account-details';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useMileageRate } from '@/hooks/use-mileage-rate';
import { calculateDistance } from '@/ai/flows/calculate-distance';
import { Loader2, Route, Paperclip, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AddressAutocompleteInput } from '@/components/address-autocomplete-input';
import { useAccountLedger } from '@/app/savings/hooks/use-account-ledger';
import { ScrollArea } from '@/components/ui/scroll-area';

const formSchema = z.object({
  expenseType: z.enum(['Monetary', 'Mileage', 'Honorarium']),
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  date: z.string().min(1, 'A date is required.'),
  // Monetary fields
  amount: z.coerce.number().optional(),
  category: z.string().optional(),
  transferee: z.string().optional(),
  reimbursable: z.boolean().optional(),
  frequency: z.enum(['One-Time', 'Weekly', 'Bi-Weekly', 'Monthly', 'Monthly (Last Day)']).optional(),
  receipt: z.any().optional().nullable(),
  // Mileage fields
  origin: z.string().optional(),
  destination: z.string().optional(),
  distance: z.coerce.number().optional(),
  rate: z.coerce.number().optional(),
  tripType: z.enum(['One-Way', 'Return']).optional(),
  // New ledger field
  ledgerAccountId: z.string().optional(),
  forNextMonth: z.boolean().optional(),
}).refine(data => {
    if (data.expenseType === 'Monetary') {
        return !!data.amount && data.amount > 0 && !!data.category && !!data.transferee && data.reimbursable !== undefined && !!data.frequency;
    }
    return true;
}, {
    message: 'All fields are required for monetary expenses.',
    path: ['amount'],
}).refine(data => {
    if (data.expenseType === 'Mileage') {
        return !!data.distance && data.distance > 0 && data.rate !== undefined;
    }
    return true;
}, {
    message: 'Distance and rate are required for mileage expenses.',
    path: ['distance'],
}).refine(data => {
    if (data.expenseType === 'Honorarium') {
        return !!data.amount && data.amount > 0;
    }
    return true;
}, {
    message: 'Amount is required for honorariums.',
    path: ['amount'],
});


type ExpenseFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addExpense: (item: Omit<Expense, 'id'>, ledgerAccountId: string | undefined, receiptFile: UploadableFile | null | undefined, callback: (success: boolean) => void) => void;
  updateExpense: (id: string, item: Partial<Omit<Expense, 'id'>>) => void;
  addMileage: (item: Omit<MileageLog, 'id'>) => void;
  updateMileage: (id: string, item: Partial<Omit<MileageLog, 'id'>>) => void;
  addHonorarium: (item: Omit<Honorarium, 'id'>) => void;
  updateHonorarium: (id: string, item: Partial<Omit<Honorarium, 'id'>>) => void;
  editingItem: Expense | MileageLog | Honorarium | null;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export function ExpenseForm({ 
    open, 
    onOpenChange, 
    addExpense, 
    updateExpense, 
    addMileage,
    updateMileage,
    addHonorarium,
    updateHonorarium,
    editingItem 
}: ExpenseFormProps) {
  const { categories: workCategories } = useWorkCategories();
  const { accounts: transferees } = useAccountDetails();
  const { ledgerItems: accountLedgerItems } = useAccountLedger(null);
  const { mileageRate, isLoading: isRateLoading } = useMileageRate();
  const [isCalculating, setIsCalculating] = useState(false);
  const { toast } = useToast();
  const oneWayDistanceRef = useRef<number | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      expenseType: 'Monetary',
      description: '',
      date: new Date().toISOString().split('T')[0],
      amount: 0,
      category: '',
      transferee: '',
      reimbursable: true, // Default to true now
      frequency: 'One-Time',
      receipt: null,
      origin: '',
      destination: '',
      distance: 0,
      rate: 0.50,
      tripType: 'One-Way',
      ledgerAccountId: '',
      forNextMonth: false,
    },
  });

  const expenseType = form.watch('expenseType');
  const tripType = form.watch('tripType');
  const category = form.watch('category');
  const isReimbursable = form.watch('reimbursable');
  const receiptFile = form.watch('receipt');
  
  // Set reimbursable to false if category is Church Expense
  useEffect(() => {
    if (category === 'Church Expense') {
      form.setValue('reimbursable', false);
    } else {
      form.setValue('reimbursable', true);
    }
  }, [category, form]);

  // Effect to set the mileage rate from settings when it loads
  useEffect(() => {
    if (!isRateLoading && mileageRate !== null) {
        form.setValue('rate', mileageRate);
    }
  }, [isRateLoading, mileageRate, form]);
  
  // Effect to reset form state when opening for a new item or editing an existing one
  useEffect(() => {
    if (open) {
      const defaultRate = mileageRate ?? 0.50;
      if (editingItem) {
        const itemType = editingItem.type;
        form.reset({
          expenseType: itemType,
          description: editingItem.description,
          date: editingItem.date ? new Date(editingItem.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          amount: 'amount' in editingItem ? editingItem.amount : 0,
          category: 'category' in editingItem ? editingItem.category : '',
          transferee: 'transferee' in editingItem ? editingItem.transferee : '',
          reimbursable: 'reimbursable' in editingItem ? editingItem.reimbursable : true,
          frequency: 'frequency' in editingItem ? editingItem.frequency : 'One-Time',
          receipt: null, // Don't allow re-uploading for now
          forNextMonth: 'forNextMonth' in editingItem ? editingItem.forNextMonth : false,
          origin: 'origin' in editingItem ? editingItem.origin : '',
          destination: 'destination' in editingItem ? editingItem.destination : '',
          distance: 'distance' in editingItem ? editingItem.distance : 0,
          rate: 'rate' in editingItem ? editingItem.rate : defaultRate,
          tripType: 'tripType' in editingItem ? editingItem.tripType : 'One-Way',
          ledgerAccountId: '', // Do not support editing ledger withdrawal for now
        });
        if ('distance' in editingItem && editingItem.tripType === 'Return') {
            oneWayDistanceRef.current = editingItem.distance / 2;
        } else if ('distance' in editingItem) {
            oneWayDistanceRef.current = editingItem.distance;
        }
      } else {
        // Reset to defaults for a new item
        form.reset({
          expenseType: 'Monetary',
          description: '',
          date: new Date().toISOString().split('T')[0],
          amount: 0,
          category: '',
          transferee: '',
          reimbursable: true,
          frequency: 'One-Time',
          receipt: null,
          forNextMonth: false,
          origin: '',
          destination: '',
          distance: 0,
          rate: defaultRate,
          tripType: 'One-Way',
          ledgerAccountId: '',
        });
        oneWayDistanceRef.current = null;
      }
    }
  }, [editingItem, open, form, mileageRate]);


   useEffect(() => {
    if (expenseType === 'Mileage' && oneWayDistanceRef.current !== null) {
        const currentOneWayDistance = oneWayDistanceRef.current;
        const newDistance = tripType === 'Return' ? currentOneWayDistance * 2 : currentOneWayDistance;
        form.setValue('distance', parseFloat(newDistance.toFixed(1)), { shouldValidate: true });
    }
  }, [tripType, expenseType, form]);

  const handleCalculateDistance = async () => {
    const origin = form.getValues('origin');
    const destination = form.getValues('destination');

    if (!origin || !destination) {
      toast({
        title: 'Heads up!',
        description: 'Please enter both an origin and a destination.',
        variant: 'destructive'
      });
      return;
    }

    setIsCalculating(true);
    try {
      const result = await calculateDistance({ origin, destination });
      const oneWayDist = result.distance;
      oneWayDistanceRef.current = oneWayDist;

      const currentTripType = form.getValues('tripType');
      const finalDistance = currentTripType === 'Return' ? oneWayDist * 2 : oneWayDist;

      form.setValue('distance', parseFloat(finalDistance.toFixed(1)), { shouldValidate: true });
      toast({
        title: 'Success!',
        description: 'Distance has been calculated and filled in.',
      });
    } catch (error) {
      console.error('Distance calculation failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to calculate distance. Please check addresses or your API key.',
        variant: 'destructive'
      });
    } finally {
      setIsCalculating(false);
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    // This creates a date object that represents the START of the selected day in UTC.
    const utcDate = new Date(values.date + 'T00:00:00Z');

    if (values.expenseType === 'Monetary') {
        let uploadableReceipt: UploadableFile | null = null;
        if (values.receipt instanceof File) {
            const base64 = await fileToBase64(values.receipt);
            uploadableReceipt = {
                name: values.receipt.name,
                type: values.receipt.type,
                data: base64,
            };
        }

        const submissionData: Omit<Expense, 'id'> = {
            type: 'Monetary',
            description: values.description,
            amount: values.amount!,
            category: values.category!,
            transferee: values.transferee!,
            date: utcDate.toISOString(),
            reimbursable: values.reimbursable!,
            frequency: values.frequency as BudgetItemFrequency,
            completed: false,
            forNextMonth: values.forNextMonth,
            status: 'active'
        };
        if (editingItem && editingItem.type === 'Monetary') {
            updateExpense(editingItem.id, submissionData);
            onOpenChange(false);
        } else {
             addExpense(submissionData, values.ledgerAccountId, uploadableReceipt, (success) => {
              if (success) {
                onOpenChange(false);
              }
            });
        }
    } else if (values.expenseType === 'Mileage') { 
        const submissionData: Omit<MileageLog, 'id'> = {
            type: 'Mileage',
            description: values.description,
            origin: values.origin || '',
            destination: values.destination || '',
            distance: values.distance!,
            rate: values.rate!,
            date: utcDate.toISOString(),
            tripType: values.tripType as TripType,
            forNextMonth: values.forNextMonth,
            status: 'active'
        };
        if (editingItem && editingItem.type === 'Mileage') {
            updateMileage(editingItem.id, submissionData);
        } else {
            addMileage(submissionData);
        }
        onOpenChange(false);
    } else { // Honorarium
         const submissionData: Omit<Honorarium, 'id'> = {
            type: 'Honorarium',
            description: values.description,
            amount: values.amount!,
            date: utcDate.toISOString(),
            status: 'active'
        };
         if (editingItem && editingItem.type === 'Honorarium') {
            updateHonorarium(editingItem.id, submissionData);
        } else {
            addHonorarium(submissionData);
        }
        onOpenChange(false);
    }
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
            <ScrollArea className="h-[60vh] pr-6 -mr-6">
              <div className="space-y-4">
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
                            <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl><RadioGroupItem value="Honorarium" /></FormControl>
                                <FormLabel className="font-normal">Honorarium</FormLabel>
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
                      <FormControl><Input type="date" {...field} value={field.value ? field.value.split('T')[0] : ''} /></FormControl>
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

                {(expenseType === 'Monetary' || expenseType === 'Mileage') && (
                    <FormField
                        control={form.control}
                        name="forNextMonth"
                        render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                                <FormLabel>For Next Month's Expenses</FormLabel>
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
                )}

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
                                    {workCategories.map(category => (
                                    <SelectItem key={category.id} value={category.name}>{category.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField control={form.control} name="frequency" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Frequency</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                <FormControl>
                                <SelectTrigger><SelectValue placeholder="Select frequency" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                <SelectItem value="One-Time">One-Time</SelectItem>
                                <SelectItem value="Weekly">Weekly</SelectItem>
                                <SelectItem value="Bi-Weekly">Bi-Weekly</SelectItem>
                                <SelectItem value="Monthly">Monthly</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField control={form.control} name="transferee" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Payment Source</FormLabel>
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
                        <FormField
                            control={form.control}
                            name="receipt"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Receipt (Optional)</FormLabel>
                                {receiptFile && receiptFile instanceof File ? (
                                    <div className="flex items-center justify-between p-2 border rounded-md">
                                        <span className="text-sm truncate">{receiptFile.name}</span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => form.setValue('receipt', null)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ) : (
                                    <FormControl>
                                        <div className="relative">
                                            <Input
                                                type="file"
                                                accept="image/*,.pdf"
                                                onChange={(e) => field.onChange(e.target.files ? e.target.files[0] : null)}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            />
                                            <div className="flex items-center justify-center h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
                                                <Paperclip className="mr-2 h-4 w-4" />
                                                <span>{(editingItem as Expense)?.receiptUrl ? 'Replace receipt' : 'Attach a receipt'}</span>
                                            </div>
                                        </div>
                                    </FormControl>
                                )}
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </>
                )}

                {expenseType === 'Mileage' && (
                    <>
                        <FormField control={form.control} name="origin" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Origin</FormLabel>
                                <AddressAutocompleteInput
                                    field={field}
                                    onSelect={(address) => form.setValue('origin', address, { shouldValidate: true })}
                                />
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField control={form.control} name="destination" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Destination</FormLabel>
                                <AddressAutocompleteInput
                                    field={field}
                                    onSelect={(address) => form.setValue('destination', address, { shouldValidate: true })}
                                />
                                <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                            control={form.control}
                            name="tripType"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                <FormLabel>Trip Type</FormLabel>
                                <FormControl>
                                    <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="flex space-x-4"
                                    >
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl><RadioGroupItem value="One-Way" /></FormControl>
                                        <FormLabel className="font-normal">One-Way</FormLabel>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                        <FormControl><RadioGroupItem value="Return" /></FormControl>
                                        <FormLabel className="font-normal">Return</FormLabel>
                                    </FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex items-end gap-2">
                            <FormField control={form.control} name="distance" render={({ field }) => (
                                <FormItem className="flex-grow">
                                    <FormLabel>Distance (km)</FormLabel>
                                    <FormControl><Input type="number" step="0.1" {...field} onChange={(e) => {
                                        const value = e.target.value;
                                        field.onChange(value === '' ? '' : parseFloat(value));
                                        oneWayDistanceRef.current = parseFloat(value) / (tripType === 'Return' ? 2 : 1);
                                    }} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                            />
                            <Button type="button" variant="outline" onClick={handleCalculateDistance} disabled={isCalculating}>
                              {isCalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Route className="mr-2 h-4 w-4" />}
                                Calculate
                            </Button>
                        </div>
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

                {expenseType === 'Honorarium' && (
                    <FormField control={form.control} name="amount" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Amount</FormLabel>
                            <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                    />
                )}

                {expenseType === 'Monetary' && (
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
                            disabled={category === 'Church Expense'}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}

                {expenseType === 'Monetary' && isReimbursable && !editingItem && (
                  <FormField
                      control={form.control}
                      name="ledgerAccountId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Withdraw from Fund (Optional)</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                              <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select a fund to withdraw from" />
                                  </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                  {accountLedgerItems.map(item => (
                                  <SelectItem key={item.id} value={item.id}>{item.name} ({new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.amount)})</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                  />
                )}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button type="submit">{editingItem ? 'Save Changes' : 'Add Expense'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
