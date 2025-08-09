
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, PlusCircle, Minus, Plus, User, Users } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from './ui/separator';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';

type Person = {
  id: string;
  name: string;
}

type SplitItem = {
  id: string;
  amount: number;
  taxRate: number; // e.g., 0, 5, 8, 13
  assignedTo: string[]; // Array of Person IDs
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function SplitCalculator() {
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<SplitItem[]>([]);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const initialPeople = [
        { id: crypto.randomUUID(), name: 'Person 1' },
        { id: crypto.randomUUID(), name: 'Person 2' },
    ];
    setPeople(initialPeople);
    setItems([
        { id: crypto.randomUUID(), amount: 0, taxRate: 0, assignedTo: initialPeople.map(p => p.id) },
    ]);
  }, []);


  const handleAddPerson = () => {
    const newPersonId = crypto.randomUUID();
    setPeople([...people, { id: newPersonId, name: `Person ${people.length + 1}` }]);
    // Optional: automatically assign new person to existing items? For now, no.
  };

  const handleRemovePerson = () => {
    if (people.length > 1) {
        const personToRemove = people[people.length - 1];
        setPeople(people.slice(0, -1));
        // Remove this person from any item assignments
        setItems(items.map(item => ({
            ...item,
            assignedTo: item.assignedTo.filter(id => id !== personToRemove.id)
        })));
    }
  };

  const handleAddItem = () => {
    setItems([...items, { id: crypto.randomUUID(), amount: 0, taxRate: 0, assignedTo: people.map(p => p.id) }]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: 'amount' | 'taxRate', value: number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleAssignmentChange = (itemId: string, personId: string, isChecked: boolean) => {
    setItems(items.map(item => {
        if (item.id === itemId) {
            const newAssignedTo = isChecked
                ? [...item.assignedTo, personId]
                : item.assignedTo.filter(id => id !== personId);
            return { ...item, assignedTo: newAssignedTo };
        }
        return item;
    }));
  };

  const { grandTotal, personTotals } = useMemo(() => {
    const personTotalsMap = new Map<string, number>(people.map(p => [p.id, 0]));

    let currentGrandTotal = 0;

    items.forEach(item => {
      const taxMultiplier = 1 + item.taxRate / 100;
      const itemTotal = item.amount * taxMultiplier;
      currentGrandTotal += itemTotal;

      const numAssigned = item.assignedTo.length;
      if (numAssigned > 0) {
        const costPerPerson = itemTotal / numAssigned;
        item.assignedTo.forEach(personId => {
          personTotalsMap.set(personId, (personTotalsMap.get(personId) || 0) + costPerPerson);
        });
      }
    });

    return {
      grandTotal: currentGrandTotal,
      personTotals: Array.from(personTotalsMap.entries()).map(([personId, total]) => ({
        personId,
        name: people.find(p => p.id === personId)?.name || '',
        total,
      })),
    };
  }, [items, people]);

  if (!isClient) {
    return null; // or a loading skeleton
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Split Expense Calculator</CardTitle>
        <CardDescription>
          Assign items to different people and calculate how much each person owes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

         {/* People Split Section */}
        <div className="space-y-4">
             <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium flex items-center gap-2"><Users className="h-5 w-5"/>People</h3>
                <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" onClick={handleRemovePerson} disabled={people.length <= 1}>
                        <Minus className="h-4 w-4" />
                    </Button>
                    <span className="text-xl font-bold w-12 text-center">{people.length}</span>
                    <Button size="icon" variant="outline" onClick={handleAddPerson}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {people.map(p => (
                    <div key={p.id} className="p-2 border rounded-md bg-secondary/30 text-center text-sm font-medium">
                        {p.name}
                    </div>
                ))}
            </div>
        </div>

        <Separator />

        {/* Items Section */}
        <div className="space-y-4">
            <h3 className="text-lg font-medium">Items</h3>
            {items.map((item) => (
                <div key={item.id} className="p-4 border rounded-lg space-y-4 bg-card">
                     <div className="flex items-start gap-2">
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
                            className="h-9 w-9 text-destructive flex-shrink-0"
                            onClick={() => handleRemoveItem(item.id)}
                            disabled={items.length <= 1}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                    <div>
                        <Label className="text-xs text-muted-foreground mb-2 block">Assigned To:</Label>
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                            {people.map(person => (
                                <div key={person.id} className="flex items-center gap-2">
                                    <Checkbox
                                        id={`item-${item.id}-person-${person.id}`}
                                        checked={item.assignedTo.includes(person.id)}
                                        onCheckedChange={(checked) => handleAssignmentChange(item.id, person.id, !!checked)}
                                    />
                                    <Label htmlFor={`item-${item.id}-person-${person.id}`} className="text-sm font-normal">
                                        {person.name}
                                    </Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ))}
            <Button variant="outline" onClick={handleAddItem}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Item
            </Button>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch space-y-4 bg-secondary/50 p-6 rounded-b-lg">
          <div className="flex justify-between text-lg font-medium">
            <span>Grand Total</span>
            <span>{formatCurrency(grandTotal)}</span>
          </div>
          <Separator />
          <div className="space-y-2">
            {personTotals.map(personTotal => (
                 <div key={personTotal.personId} className="flex justify-between text-lg font-semibold text-primary">
                    <span>{personTotal.name}'s Total</span>
                    <span>{formatCurrency(personTotal.total)}</span>
                </div>
            ))}
          </div>
      </CardFooter>
    </Card>
  );
}
