
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
import * as XLSX from 'xlsx';

export default function ExpensesPage() {
  const { expenses } = useExpenses();
  const { mileageLogs } = useMileage();

  const handleExport = () => {
    // 1. Determine Month Name
    const allDates = [
      ...expenses.map(e => new Date(e.date)),
      ...mileageLogs.map(m => new Date(m.date))
    ];
    let monthName = format(new Date(), 'MMMM yyyy');
    if (allDates.length > 0) {
      const mostRecentDate = allDates.reduce((a, b) => a > b ? a : b);
      monthName = format(mostRecentDate, 'MMMM yyyy');
    }

    // 2. Prepare Data for XLSX
    const mainHeader = [`${monthName} Expenses`];
    
    // Section 1: Mileage
    const mileageHeader = ['Date', 'Description', 'Distance (km)', 'Rate', 'Total'];
    const mileageRows = mileageLogs.map(item => [
      format(new Date(item.date), 'yyyy-MM-dd'),
      item.description,
      item.distance,
      item.rate,
      item.distance * item.rate
    ]);

    // Section 2: Credit Card Expenses
    const creditCardExpenses = expenses.filter(e => e.transferee === 'Work Visa');
    const creditCardHeader = ['Date', 'Description', 'Category', 'Amount', 'Reimbursable'];
    const creditCardRows = creditCardExpenses.map(item => [
      format(new Date(item.date), 'yyyy-MM-dd'),
      item.description,
      item.category,
      item.amount,
      item.reimbursable ? 'Yes' : 'No'
    ]);

    // Section 3: Other Reimbursable
    const otherReimbursableExpenses = expenses.filter(e => e.transferee !== 'Work Visa' && e.reimbursable);
    const otherReimbursableHeader = ['Date', 'Description', 'Category', 'Paid From', 'Amount'];
    const otherReimbursableRows = otherReimbursableExpenses.map(item => [
      format(new Date(item.date), 'yyyy-MM-dd'),
      item.description,
      item.category,
      item.transferee,
      item.amount
    ]);

    // 3. Combine all data into a single array for the worksheet
    const data = [
      mainHeader,
      [], // Spacer row
      ['Mileage'],
      mileageHeader,
      ...mileageRows,
      [], // Spacer row
      ['Credit Card Expenses (Work Visa)'],
      creditCardHeader,
      ...creditCardRows,
      [], // Spacer row
      ['Other Reimbursable Expenses'],
      otherReimbursableHeader,
      ...otherReimbursableRows
    ];
    
    // 4. Create Worksheet and Workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);

    // 5. Apply Styling and Merges
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }]; 

    if (!ws['A1']) ws['A1'] = {t:'s', v: mainHeader[0]};
    ws['A1'].s = {
      font: { sz: 16, bold: true },
      alignment: { horizontal: 'center', vertical: 'center' }
    };

    const boldStyle = { font: { bold: true } };
    
    // Style section headers
    const sectionHeaderRefs = [
        'A3', // Mileage
        `A${6 + mileageRows.length}`, // Credit Card
        `A${9 + mileageRows.length + creditCardRows.length}` // Other Reimbursable
    ];
    sectionHeaderRefs.forEach(cellRef => {
        if(ws[cellRef]) ws[cellRef].s = boldStyle;
    });

    // Style column headers
    const mileageHeaderRow = 3;
    mileageHeader.forEach((_, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({c: colIndex, r: mileageHeaderRow});
        if (ws[cellRef]) ws[cellRef].s = boldStyle;
    });
    
    const creditCardHeaderRow = 6 + mileageRows.length;
    creditCardHeader.forEach((_, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({c: colIndex, r: creditCardHeaderRow});
        if (ws[cellRef]) ws[cellRef].s = boldStyle;
    });

    const otherReimbursableHeaderRow = 9 + mileageRows.length + creditCardRows.length;
    otherReimbursableHeader.forEach((_, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({c: colIndex, r: otherReimbursableHeaderRow});
        if (ws[cellRef]) ws[cellRef].s = boldStyle;
    });


    // Set column widths
    const colWidths = [
      { wch: 15 }, // Date
      { wch: 40 }, // Description
      { wch: 15 }, // Category / Distance
      { wch: 15 }, // Amount / Rate
      { wch: 15 }  // Reimbursable / Total
    ];
    ws['!cols'] = colWidths;
    
    // 6. Append worksheet to workbook and download
    XLSX.utils.book_append_sheet(wb, ws, 'Work Expenses');
    XLSX.writeFile(wb, `work-expenses-${monthName.replace(' ', '-')}.xlsx`);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const totalMonetaryExpenses = expenses.reduce((acc, item) => acc + item.amount, 0);
  const reimbursableMonetary = expenses
    .filter((item) => item.reimbursable && item.transferee !== 'Work Visa')
    .reduce((acc, item) => acc + item.amount, 0);
  
  // All mileage is considered reimbursable in the total calculation
  const totalMileageReimbursement = mileageLogs
    .reduce((acc, item) => acc + (item.distance * item.rate), 0);
    
  const totalReimbursable = reimbursableMonetary + totalMileageReimbursement;


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
            Export to XLSX
        </Button>
      </header>
      <main>
        <div className="flex justify-between items-center mb-6 gap-2">
            <h2 className="text-3xl font-bold font-headline text-primary">Work Expense Tracking</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            <div className="p-4 border rounded-lg bg-card">
                <h4 className="text-muted-foreground">Total Monetary Expenses</h4>
                <p className="text-2xl font-semibold">{formatCurrency(totalMonetaryExpenses)}</p>
            </div>
            <div className="p-4 border rounded-lg bg-card">
                <h4 className="text-muted-foreground">Total Reimbursable (Monetary + Mileage)</h4>
                <p className="text-2xl font-semibold">{formatCurrency(totalReimbursable)}</p>
            </div>
        </div>

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
