'use client';

import { useEffect } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Debt, DebtType } from '@/types';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

const formSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters.'),
  interestRate: z.coerce.number().min(0, 'Interest rate must be a positive number.'),
  debtType: z.enum(['Credit Card', 'Loan', 'Line of Credit']),
  balance: z.coerce.number().min(0, 'Balance must be a positive number.'),
  minimumPayment: z.coerce.number().min(0, 'Minimum payment must be a positive number.'),
  plannedPayment: z.coerce.number().min(0, 'Planned payment must be a positive number.'),
  dueDate: z.string().min(1, 'A due date is required.'),
});

type DebtFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addDebt: (debt: Omit<Debt, 'id' | 'order'>) => void;
  updateDebt: (id: string, debt: Partial<Omit<Debt, 'id' | 'order'>>) => void;
  editingDebt: Debt | null;
};

export function DebtForm({ open, onOpenChange, addDebt, updateDebt, editingDebt }: DebtFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      interestRate: 0,
      debtType: 'Credit Card',
      balance: 0,
      minimumPayment: 0,
      plannedPayment: 0,
      dueDate: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (editingDebt) {
        form.reset({
          name: editingDebt.name,
          interestRate: editingDebt.interestRate || 0,
          debtType: editingDebt.debtType || 'Credit Card',
          balance: editingDebt.balance || 0,
          minimumPayment: editingDebt.minimumPayment || 0,
          plannedPayment: editingDebt.plannedPayment || 0,
          dueDate: editingDebt.dueDate || '',
        });
      } else {
        const today = new Date().toISOString().split('T')[0];
        form.reset({
          name: '',
          interestRate: 0,
          debtType: 'Credit Card',
          balance: 0,
          minimumPayment: 0,
          plannedPayment: 0,
          dueDate: today,
        });
      }
    }
  }, [editingDebt, open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    const submissionData = { 
        ...values, 
        debtType: values.debtType as DebtType,
    };

    if (editingDebt) {
      updateDebt(editingDebt.id, submissionData);
    } else {
      addDebt(submissionData as Omit<Debt, 'id' | 'order'>);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingDebt ? 'Edit Debt' : 'Add New Debt'}</DialogTitle>
          <DialogDescription>
            {editingDebt ? 'Update the details for your debt.' : 'Fill in the details for your new debt entry.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <ScrollArea className="h-[60vh] pr-6 -mr-6">
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Debt Name</FormLabel>
                            <FormControl>
                            <Input placeholder="e.g., Credit Card" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField control={form.control} name="debtType" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Debt Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="Credit Card">Credit Card</SelectItem>
                                    <SelectItem value="Loan">Loan</SelectItem>
                                    <SelectItem value="Line of Credit">Line of Credit</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    <FormField control={form.control} name="interestRate" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Interest Rate (%)</FormLabel>
                            <FormControl>
                            <Input type="number" step="0.01" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                        )}
                    />
                    </div>

                    <Separator />
                    <h4 className="text-md font-medium text-center">Monthly Plan details</h4>
                    <Separator />

                    <FormField control={form.control} name="balance" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Balance</FormLabel>
                        <FormControl>
                            <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField control={form.control} name="minimumPayment" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Minimum Payment</FormLabel>
                        <FormControl>
                            <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField control={form.control} name="plannedPayment" render={({ field }) => (
                        <FormItem>
                        <div className="flex justify-between items-center">
                            <FormLabel>Planned Payment</FormLabel>
                            <Button 
                              type="button" 
                              variant="link" 
                              className="h-auto p-0 text-xs text-primary" 
                              onClick={() => {
                                const minPay = form.getValues('minimumPayment');
                                form.setValue('plannedPayment', minPay);
                              }}
                            >
                              Copy Minimum
                            </Button>
                        </div>
                        <FormControl>
                            <Input type="number" step="0.01" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField control={form.control} name="dueDate" render={({ field }) => (
                        <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
            </ScrollArea>
            <DialogFooter>
              <Button type="submit">{editingDebt ? 'Save Changes' : 'Add Debt'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
