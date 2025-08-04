
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

  const escapeCsvCell = (cell: string | number | boolean) => {
    const cellStr = String(cell);
    if (cellStr.includes(',')) {
      return `"${cellStr.replace(/"/g, '""')}"`;
    }
    return cellStr;
  };
  
  const handleExport = () => {
    // Section 1: Mileage
    const mileageHeader = ['Date', 'Description', 'Distance (km)', 'Rate', 'Total', 'Reimbursable'];
    const mileageRows = mileageLogs.map(item => [
      format(new Date(item.date), 'yyyy-MM-dd'),
      escapeCsvCell(item.description),
      item.distance.toFixed(1),
      item.rate.toFixed(2),
      (item.distance * item.rate).toFixed(2),
      item.reimbursable ? 'Yes' : 'No'
    ].join(','));
    const mileageCsv = [mileageHeader.join(','), ...mileageRows].join('\n');

    // Section 2: Credit Card Expenses (Work Visa)
    const creditCardExpenses = expenses.filter(e => e.transferee === 'Work Visa');
    const creditCardHeader = ['Date', 'Description', 'Category', 'Amount', 'Reimbursable'];
    const creditCardRows = creditCardExpenses.map(item => [
      format(new Date(item.date), 'yyyy-MM-dd'),
      escapeCsvCell(item.description),
      escapeCsvCell(item.category),
      item.amount.toFixed(2),
      item.reimbursable ? 'Yes' : 'No'
    ].join(','));
    const creditCardCsv = [creditCardHeader.join(','), ...creditCardRows].join('\n');

    // Section 3: Other Reimbursable Expenses
    const otherReimbursableExpenses = expenses.filter(e => e.transferee !== 'Work Visa' && e.reimbursable);
    const otherReimbursableHeader = ['Date', 'Description', 'Category', 'Paid From', 'Amount'];
    const otherReimbursableRows = otherReimbursableExpenses.map(item => [
      format(new Date(item.date), 'yyyy-MM-dd'),
      escapeCsvCell(item.description),
      escapeCsvCell(item.category),
      escapeCsvCell(item.transferee),
      item.amount.toFixed(2)
    ].join(','));
    const otherReimbursableCsv = [otherReimbursableHeader.join(','), ...otherReimbursableRows].join('\n');

    const csvContent = [
      'Mileage',
      mileageCsv,
      '',
      'Credit Card Expenses (Work Visa)',
      creditCardCsv,
      '',
      'Other Reimbursable Expenses',
      otherReimbursableCsv
    ].join('\n');

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
        <Button variant="outline" onClick={handleExport} >
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
