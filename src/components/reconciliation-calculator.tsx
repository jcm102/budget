
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, PlusCircle, RotateCcw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDebt } from '@/hooks/use-debt';
import { Skeleton } from './ui/skeleton';

type ReconciliationItem = {
  id: string;
  payeeId: string;
  source1Amount: number;
  source2Amount: number;
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function ReconciliationCalculator() {
  const { debts, isLoading: isLoadingDebts } = useDebt();
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [source1Name, setSource1Name] = useState('Source 1');
  const [source2Name, setSource2Name] = useState('Source 2');

  // Effect to add a default item when the component loads and debts are available
  useEffect(() => {
    if (items.length === 0 && !isLoadingDebts && debts.length > 0) {
      handleAddItem();
    }
  }, [items.length, isLoadingDebts, debts.length]);


  const handleAddItem = () => {
    const defaultPayeeId = debts.length > 0 ? debts[0].id : '';
    setItems([...items, { id: crypto.randomUUID(), payeeId: defaultPayeeId, source1Amount: 0, source2Amount: 0 }]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: 'payeeId' | 'source1Amount' | 'source2Amount', value: string | number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };
  
  const handleClear = () => {
    setItems([]);
    handleAddItem(); // Add one blank item back
  }

  const { totalSource1, totalSource2, grandTotal } = useMemo(() => {
    const totals = items.reduce((acc, item) => {
      acc.totalSource1 += Number(item.source1Amount) || 0;
      acc.totalSource2 += Number(item.source2Amount) || 0;
      return acc;
    }, { totalSource1: 0, totalSource2: 0 });

    return {
      ...totals,
      grandTotal: totals.totalSource1 + totals.totalSource2
    };
  }, [items]);

  if (isLoadingDebts) {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-8 w-3/4" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-20 w-full" />
            </CardContent>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reconciliation Calculator</CardTitle>
        <CardDescription>
          A temporary tool to calculate payments for reconciliation. Data is not saved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Column Headers */}
        <div className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-4 font-medium">Payee (From Debt List)</div>
            <div className="col-span-3">
                <Input 
                    value={source1Name} 
                    onChange={(e) => setSource1Name(e.target.value)} 
                    className="font-medium"
                    placeholder="Source 1 Name"
                />
            </div>
            <div className="col-span-3">
                 <Input 
                    value={source2Name} 
                    onChange={(e) => setSource2Name(e.target.value)} 
                    className="font-medium"
                    placeholder="Source 2 Name"
                />
            </div>
            <div className="col-span-2 font-medium text-right">Row Total</div>
        </div>
        {/* Items Section */}
        <div className="space-y-2">
            {items.map((item) => {
                const rowTotal = (Number(item.source1Amount) || 0) + (Number(item.source2Amount) || 0);
                return (
                    <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-4">
                            <Select
                                onValueChange={(value) => handleItemChange(item.id, 'payeeId', value)}
                                defaultValue={item.payeeId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select Payee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {debts.map(debt => (
                                        <SelectItem key={debt.id} value={debt.id}>{debt.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="col-span-3">
                             <Input
                                type="number"
                                placeholder="Amount"
                                value={item.source1Amount || ''}
                                onChange={(e) => handleItemChange(item.id, 'source1Amount', parseFloat(e.target.value))}
                            />
                        </div>
                        <div className="col-span-3">
                             <Input
                                type="number"
                                placeholder="Amount"
                                value={item.source2Amount || ''}
                                onChange={(e) => handleItemChange(item.id, 'source2Amount', parseFloat(e.target.value))}
                            />
                        </div>
                         <div className="col-span-1 font-medium text-right">
                            {formatCurrency(rowTotal)}
                        </div>
                        <div className="col-span-1 text-right">
                             <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 text-destructive"
                                onClick={() => handleRemoveItem(item.id)}
                                disabled={items.length <= 1}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )
            })}
        </div>
        <div className="flex gap-2">
            <Button variant="outline" onClick={handleAddItem}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Payment
            </Button>
             <Button variant="destructive" onClick={handleClear}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Clear All
            </Button>
        </div>

      </CardContent>
      <CardFooter className="flex flex-col items-stretch space-y-2 bg-secondary/50 p-6 rounded-b-lg">
          <div className="flex justify-between text-md font-medium">
            <span>{source1Name} Total</span>
            <span>{formatCurrency(totalSource1)}</span>
          </div>
           <div className="flex justify-between text-md font-medium">
            <span>{source2Name} Total</span>
            <span>{formatCurrency(totalSource2)}</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t pt-2 mt-2">
            <span>Grand Total</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
      </CardFooter>
    </Card>
  );
}

