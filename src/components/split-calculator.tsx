
'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, PlusCircle, Minus, Plus } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from './ui/separator';

type SplitItem = {
  id: string;
  amount: number;
  taxRate: number; // e.g., 0, 5, 8, 13
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function SplitCalculator() {
  const [items, setItems] = useState<SplitItem[]>([{ id: crypto.randomUUID(), amount: 0, taxRate: 0 }]);
  const [numPeople, setNumPeople] = useState(2);

  const handleAddItem = () => {
    setItems([...items, { id: crypto.randomUUID(), amount: 0, taxRate: 0 }]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: 'amount' | 'taxRate', value: number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleNumPeopleChange = (change: number) => {
    setNumPeople(prev => Math.max(1, prev + change));
  }

  const { grandTotal, totalPerPerson } = useMemo(() => {
    const total = items.reduce((acc, item) => {
      const taxMultiplier = 1 + item.taxRate / 100;
      return acc + item.amount * taxMultiplier;
    }, 0);

    return {
      grandTotal: total,
      totalPerPerson: total / numPeople,
    };
  }, [items, numPeople]);


  return (
    <Card>
      <CardHeader>
        <CardTitle>Split Expense Calculator</CardTitle>
        <CardDescription>
          Enter the amounts for each item, select a tax rate, and see the split total per person.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Items Section */}
        <div className="space-y-4">
            {items.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                    <div className="flex-grow grid grid-cols-2 gap-2">
                        <Input
                            type="number"
                            placeholder="Amount"
                            value={item.amount || ''}
                            onChange={(e) => handleItemChange(item.id, 'amount', parseFloat(e.target.value) || 0)}
                        />
                         <Select
                            onValueChange={(value) => handleItemChange(item.id, 'taxRate', parseInt(value))}
                            defaultValue={String(item.taxRate)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Tax Rate" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="0">No Tax</SelectItem>
                                <SelectItem value="5">5%</SelectItem>
                                <SelectItem value="8">8%</SelectItem>
                                <SelectItem value="13">13%</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
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
            ))}
            <Button variant="outline" onClick={handleAddItem}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Item
            </Button>
        </div>

        <Separator />

        {/* People Split Section */}
        <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Split Between</h3>
            <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" onClick={() => handleNumPeopleChange(-1)} disabled={numPeople <= 1}>
                    <Minus className="h-4 w-4" />
                </Button>
                <span className="text-xl font-bold w-12 text-center">{numPeople}</span>
                 <Button size="icon" variant="outline" onClick={() => handleNumPeopleChange(1)}>
                    <Plus className="h-4 w-4" />
                </Button>
            </div>
        </div>

      </CardContent>
      <CardFooter className="flex flex-col items-stretch space-y-4 bg-secondary/50 p-6 rounded-b-lg">
          <div className="flex justify-between text-lg font-medium">
            <span>Grand Total</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
          <div className="flex justify-between text-2xl font-bold text-primary">
            <span>Total Per Person</span>
            <span>{formatCurrency(totalPerPerson)}</span>
          </div>
      </CardFooter>
    </Card>
  );
}
