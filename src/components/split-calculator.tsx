
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, PlusCircle, User, Users, ChevronDown } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Separator } from './ui/separator';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { usePeople } from '@/hooks/use-people';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';

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
  const { people, updatePerson, isLoading: isLoadingPeople } = usePeople();
  const [items, setItems] = useState<SplitItem[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  
  const selectedPeople = useMemo(() => {
    return people.filter(p => selectedPersonIds.includes(p.id));
  }, [people, selectedPersonIds]);


  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    // Initialize with one item and all people selected when the component mounts and people are loaded
    if (isClient && people.length > 0) {
        if (items.length === 0) {
            setItems([
                { id: crypto.randomUUID(), amount: 0, taxRate: 0, assignedTo: people.map(p => p.id) },
            ]);
        }
        if (selectedPersonIds.length === 0) {
            setSelectedPersonIds(people.map(p => p.id));
        }
    }
  }, [isClient, people, items.length, selectedPersonIds.length]);


  const handleAddItem = () => {
    setItems([...items, { id: crypto.randomUUID(), amount: 0, taxRate: 0, assignedTo: selectedPersonIds }]);
  };

  const handleRemoveItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleItemChange = (id: string, field: 'amount' | 'taxRate', value: number) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleItemAssignmentChange = (itemId: string, personId: string, isChecked: boolean) => {
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
  
  const handlePersonSelectionChange = (personId: string, isChecked: boolean) => {
    let newSelectedIds;
    if (isChecked) {
        newSelectedIds = [...selectedPersonIds, personId];
    } else {
        newSelectedIds = selectedPersonIds.filter(id => id !== personId);
    }
    setSelectedPersonIds(newSelectedIds);

    // When a person is deselected, remove them from all item assignments
    if (!isChecked) {
        setItems(items.map(item => ({
            ...item,
            assignedTo: item.assignedTo.filter(id => id !== personId)
        })));
    }
  };


  const handleNameChange = (personId: string, newName: string) => {
    updatePerson(personId, newName);
  }

  const { grandTotal, personTotals } = useMemo(() => {
    const personTotalsMap = new Map<string, number>(selectedPeople.map(p => [p.id, 0]));

    let currentGrandTotal = 0;

    items.forEach(item => {
      const taxMultiplier = 1 + item.taxRate / 100;
      const itemTotal = item.amount * taxMultiplier;
      currentGrandTotal += itemTotal;

      const numAssigned = item.assignedTo.length;
      if (numAssigned > 0) {
        const costPerPerson = itemTotal / numAssigned;
        item.assignedTo.forEach(personId => {
            if(personTotalsMap.has(personId)) {
                personTotalsMap.set(personId, (personTotalsMap.get(personId) || 0) + costPerPerson);
            }
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
  }, [items, selectedPeople, people]);

  if (!isClient) {
    return (
        <Card>
            <CardHeader>
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-40 w-full" />
            </CardContent>
            <CardFooter>
                 <Skeleton className="h-20 w-full" />
            </CardFooter>
        </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Split Expense Calculator</CardTitle>
        <CardDescription>
          Assign items to different people and calculate how much each person owes. Manage the list of people in Settings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

         {/* People Selection Section */}
        <div className="space-y-2">
             <h3 className="text-lg font-medium flex items-center gap-2"><Users className="h-5 w-5"/>Who's Splitting?</h3>
             <div className="flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex-shrink-0">
                      <span>Select People</span>
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56">
                    <DropdownMenuLabel>Select People to Include</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                     {isLoadingPeople ? (
                        <div className="p-2"><Skeleton className="h-8 w-full" /></div>
                     ) : (
                        people.map(p => (
                            <DropdownMenuCheckboxItem
                                key={p.id}
                                checked={selectedPersonIds.includes(p.id)}
                                onCheckedChange={(checked) => handlePersonSelectionChange(p.id, !!checked)}
                            >
                                <Input 
                                    defaultValue={p.name}
                                    onBlur={(e) => handleNameChange(p.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()} // Prevent dropdown from closing
                                    className="bg-transparent border-none h-auto p-0 text-sm font-medium focus-visible:ring-0 focus-visible:ring-offset-0"
                                />
                            </DropdownMenuCheckboxItem>
                        ))
                     )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex flex-wrap gap-1">
                    {selectedPeople.length > 0 ? selectedPeople.map(p => (
                        <Badge key={p.id} variant="secondary">{p.name}</Badge>
                    )) : <span className="text-sm text-muted-foreground">No one selected</span>}
                </div>
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
                                    <SelectItem value="5">5% (GST)</SelectItem>
                                    <SelectItem value="8">8% (PST)</SelectItem>
                                    <SelectItem value="13">13% (HST)</SelectItem>
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
                            {selectedPeople.map(person => (
                                <div key={person.id} className="flex items-center gap-2">
                                    <Checkbox
                                        id={`item-${item.id}-person-${person.id}`}
                                        checked={item.assignedTo.includes(person.id)}
                                        onCheckedChange={(checked) => handleItemAssignmentChange(item.id, person.id, !!checked)}
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
