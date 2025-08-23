
'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, PlusCircle, RotateCcw } from 'lucide-react';

type Column = {
  id: string;
  name: string;
};

type Row = {
  id: string;
  description: string;
  values: Record<string, number>; // Record<columnId, amount>
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function ReconciliationCalculator() {
  const [columns, setColumns] = useState<Column[]>([
    { id: crypto.randomUUID(), name: 'Payee 1' },
    { id: crypto.randomUUID(), name: 'Payee 2' },
  ]);
  const [rows, setRows] = useState<Row[]>([
    { id: crypto.randomUUID(), description: '', values: {} },
  ]);

  const handleAddColumn = () => {
    setColumns([...columns, { id: crypto.randomUUID(), name: `Payee ${columns.length + 1}` }]);
  };

  const handleRemoveColumn = (id: string) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter(col => col.id !== id));
    // Also remove values associated with this column from all rows
    setRows(rows.map(row => {
        const newValues = { ...row.values };
        delete newValues[id];
        return { ...row, values: newValues };
    }));
  };

  const handleColumnNameChange = (id: string, name: string) => {
    setColumns(columns.map(col => col.id === id ? { ...col, name } : col));
  };

  const handleAddRow = () => {
    setRows([...rows, { id: crypto.randomUUID(), description: '', values: {} }]);
  };

  const handleRemoveRow = (id: string) => {
    if (rows.length <= 1) return;
    setRows(rows.filter(row => row.id !== id));
  };
  
  const handleRowChange = (rowId: string, field: 'description' | 'value', value: string | number, columnId?: string) => {
    setRows(rows.map(row => {
        if (row.id === rowId) {
            if (field === 'description') {
                return { ...row, description: String(value) };
            }
            if (field === 'value' && columnId) {
                const newValues = { ...row.values, [columnId]: Number(value) || 0 };
                return { ...row, values: newValues };
            }
        }
        return row;
    }));
  };

  const handleClear = () => {
    setColumns([
        { id: crypto.randomUUID(), name: 'Payee 1' },
        { id: crypto.randomUUID(), name: 'Payee 2' },
    ]);
    setRows([
        { id: crypto.randomUUID(), description: '', values: {} },
    ]);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Reconciliation Calculator</CardTitle>
        <CardDescription>
          A temporary tool to calculate payments for reconciliation. Data is not saved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 overflow-x-auto">
        <div className="min-w-max">
            {/* Column Headers */}
            <div className="grid grid-cols-12 gap-2 items-center pb-2 border-b">
                <div className="col-span-3 font-medium">Description</div>
                {columns.map(col => (
                    <div key={col.id} className="col-span-2 flex items-center gap-1">
                         <Input
                            value={col.name}
                            onChange={(e) => handleColumnNameChange(col.id, e.target.value)}
                            className="font-medium h-9"
                            placeholder="Payee Name"
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleRemoveColumn(col.id)} disabled={columns.length <= 1}>
                           <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                    </div>
                ))}
                 <div className="col-span-1">
                    <Button variant="outline" size="sm" onClick={handleAddColumn} className="w-full">
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
                                value={row.description}
                                onChange={(e) => handleRowChange(row.id, 'description', e.target.value)}
                            />
                        </div>
                         {columns.map(col => (
                            <div key={col.id} className="col-span-2">
                                <Input
                                    type="number"
                                    placeholder="Amount"
                                    value={row.values[col.id] || ''}
                                    onChange={(e) => handleRowChange(row.id, 'value', e.target.value, col.id)}
                                />
                            </div>
                        ))}
                         <div className="col-span-1 flex justify-end">
                            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => handleRemoveRow(row.id)} disabled={rows.length <= 1}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
         <div className="flex gap-2 pt-4 border-t">
            <Button variant="outline" onClick={handleAddRow}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Row
            </Button>
             <Button variant="destructive" onClick={handleClear}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Clear All
            </Button>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-stretch space-y-2 bg-secondary/50 p-6 rounded-b-lg">
          {columns.map(col => (
            <div key={col.id} className="flex justify-between text-md font-medium">
                <span>{col.name} Total</span>
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

