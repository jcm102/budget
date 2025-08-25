
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, PlusCircle, RotateCcw } from 'lucide-react';
import { useDebt } from '@/hooks/use-debt';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Skeleton } from './ui/skeleton';
import { usePaymentCalendar } from '@/hooks/use-payment-calendar';
import type { CalendarColumn, CalendarRow } from '@/types';
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
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function PaymentCalendar() {
  const { debts, isLoading: isLoadingDebts } = useDebt();
  const {
    columns,
    rows,
    isLoading: isLoadingCalendar,
    updateColumn,
    addColumn,
    removeColumn,
    updateRow,
    addRow,
    removeRow,
    clearAll
  } = usePaymentCalendar();

  const handlePayeeChange = (columnId: string, payeeId: string) => {
    const column = columns.find(c => c.id === columnId);
    if (column) {
      updateColumn(columnId, { ...column, payeeId });
    }
  };

  const handleRowChange = (rowId: string, field: 'description' | 'value', value: string | number, columnId?: string) => {
    const row = rows.find(r => r.id === rowId);
    if (!row) return;

    if (field === 'description') {
        updateRow(rowId, { ...row, description: String(value) });
    }
    if (field === 'value' && columnId) {
        const newValues = { ...row.values, [columnId]: Number(value) || 0 };
        updateRow(rowId, { ...row, values: newValues });
    }
  };


  const { columnTotals, grandTotal } = useMemo(() => {
    const totals: Record<string, number> = {};
    columns.forEach(col => totals[col.id] = 0);

    rows.forEach(row => {
        for (const colId in row.values) {
            if (totals.hasOwnProperty(colId)) {
                totals[colId] += row.values[colId];
            }
        }
    });
    
    const total = Object.values(totals).reduce((acc, val) => acc + val, 0);

    return { columnTotals: totals, grandTotal: total };
  }, [rows, columns]);
  
  const getColumnName = (columnId: string) => {
    const column = columns.find(c => c.id === columnId);
    if (!column || !column.payeeId) return "Unassigned";
    const debt = debts.find(d => d.id === column.payeeId);
    return debt ? debt.name : "Unassigned";
  }
  
  const isLoading = isLoadingDebts || isLoadingCalendar;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Calendar</CardTitle>
        <CardDescription>
          Track credit card transactions here to know what to pay at the end of the week. Data is saved automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 overflow-x-auto">
        {isLoading ? (
            <Skeleton className="h-40 w-full" />
        ) : (
            <div className="min-w-max">
                {/* Column Headers */}
                <div className="grid grid-cols-12 gap-2 items-center pb-2 border-b">
                    <div className="col-span-3 font-medium">Description</div>
                    {columns.map(col => (
                        <div key={col.id} className="col-span-2 flex items-center gap-1">
                             <Select onValueChange={(payeeId) => handlePayeeChange(col.id, payeeId)} value={col.payeeId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Payee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {debts.map(debt => (
                                        <SelectItem key={debt.id} value={debt.id}>{debt.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeColumn(col.id)} disabled={columns.length <= 1}>
                               <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))}
                     <div className="col-span-1">
                        <Button variant="outline" size="sm" onClick={() => addColumn()} className="w-full">
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Column
                        </Button>
                    </div>
                </div>
                {/* Rows Section */}
                <div className="space-y-2 mt-2">
                    {rows.map((row, rowIndex) => (
                        <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
                            <div className="col-span-3">
                                <Input 
                                    placeholder={`Item ${rowIndex + 1}`}
                                    defaultValue={row.description}
                                    onBlur={(e) => handleRowChange(row.id, 'description', e.target.value)}
                                />
                            </div>
                             {columns.map(col => (
                                <div key={col.id} className="col-span-2">
                                    <Input
                                        type="number"
                                        placeholder="Amount"
                                        defaultValue={row.values[col.id] || ''}
                                        onBlur={(e) => handleRowChange(row.id, 'value', e.target.value, col.id)}
                                    />
                                </div>
                            ))}
                             <div className="col-span-1 flex justify-end">
                                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => removeRow(row.id)} disabled={rows.length <= 1}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
         <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => addRow()}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Row
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Clear All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all entries from the payment calendar.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAll} className={cn(buttonVariants({ variant: "destructive" }))}>
                    Yes, Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch space-y-2 bg-secondary/50 p-6 rounded-b-lg">
          {columns.map(col => (
            <div key={col.id} className="flex justify-between text-md font-medium">
                <span>{getColumnName(col.id)} Total</span>
                <span>{formatCurrency(columnTotals[col.id] || 0)}</span>
            </div>
          ))}
          <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
            <span>Grand Total</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
      </CardFooter>
    </Card>
  );
}
