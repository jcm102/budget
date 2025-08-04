
'use client';

import { Button } from '@/components/ui/button';
import { ExpenseTable } from '@/components/expense-table';
import { ArrowLeft, Download } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MileageTable } from '@/components/mileage-table';
import { Banknote, Car } from 'lucide-react';
import { useExpenses } from '@/hooks/use-expenses';
import { useMileage } from '@/hooks/use-mileage';
import { format } from 'date-fns';

export default function ExpensesPage() {
  const { expenses } = useExpenses();
  const { mileageLogs } = useMileage();

  const escapeCsvCell = (cell: string) => {
    if (cell.includes(',')) {
      return `"${cell.replace(/"/g, '""')}"`;
    }
    return cell;
  };

  const handleExport = () => {
    const headers = [
      'Date',
      'Type',
      'Description',
      'Reimbursable',
      'Amount',
      'Category',
      'Paid From',
      'Distance (km)',
      'Rate',
      'Total'
    ];

    const monetaryRows = expenses.map(item => [
      format(new Date(item.date), 'yyyy-MM-dd'),
      'Monetary',
      escapeCsvCell(item.description),
      item.reimbursable ? 'Yes' : 'No',
      item.amount.toFixed(2),
      escapeCsvCell(item.category),
      escapeCsvCell(item.transferee),
      '',
      '',
      item.amount.toFixed(2),
    ]);

    const mileageRows = mileageLogs.map(item => [
      format(new Date(item.date), 'yyyy-MM-dd'),
      'Mileage',
      escapeCsvCell(item.description),
      item.reimbursable ? 'Yes' : 'No',
      '',
      '',
      '',
      item.distance.toFixed(1),
      item.rate.toFixed(2),
      (item.distance * item.rate).toFixed(2),
    ]);
    
    const allRows = [...monetaryRows, ...mileageRows];
    allRows.sort((a,b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());

    const csvContent = [headers.join(','), ...allRows.map(row => row.join(','))].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.href) {
      URL.revokeObjectURL(link.href);
    }
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'work-expenses.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-8 flex justify-between items-center">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
        <Button variant="outline" onClick={handleExport} disabled={expenses.length === 0 && mileageLogs.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export to CSV
        </Button>
      </header>
      <main>
        <Tabs defaultValue="monetary" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-secondary/50 mb-6">
            <TabsTrigger value="monetary"><Banknote className="mr-2 h-4 w-4" />Monetary Expenses</TabsTrigger>
            <TabsTrigger value="mileage"><Car className="mr-2 h-4 w-4" />Mileage Log</TabsTrigger>
          </TabsList>
          <TabsContent value="monetary">
            <ExpenseTable />
          </TabsContent>
          <TabsContent value="mileage">
            <MileageTable />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
