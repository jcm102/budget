
'use client';

import { Button } from '@/components/ui/button';
import { ExpenseTable } from '@/components/expense-table';
import { ArrowLeft, Download, Archive, CalendarClock, ChevronsUpDown, Printer } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MileageTable } from '@/components/mileage-table';
import { Banknote, Car } from 'lucide-react';
import { useExpenses } from '@/hooks/use-expenses';
import { format, parse } from 'date-fns';
import * as XLSX from 'xlsx';
import * as ExpenseService from '@/services/expense-service';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useState } from 'react';
import type { Expense, MileageLog } from '@/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { buttonVariants } from '@/components/ui/button';

type DisplayData = {
  expenses: Expense[];
  mileageLogs: MileageLog[];
};

export default function ExpensesPage() {
  const { 
    expenses: activeExpenses, 
    mileageLogs: activeMileageLogs, 
    fetchData,
    addExpense,
    updateExpense,
    deleteExpense,
    toggleExpenseCompleted,
    addMileage,
    updateMileage,
    deleteMileage,
    isLoading: dataLoading 
  } = useExpenses();
  const { toast } = useToast();
  
  const [archivedMonths, setArchivedMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('active'); // 'active' or 'YYYY-MM'
  const [displayData, setDisplayData] = useState<DisplayData>({ expenses: [], mileageLogs: [] });
  const [isArchiving, setIsArchiving] = useState(false);

  // Fetch initial data and archived months list
  useEffect(() => {
    async function loadInitialData() {
      const months = await ExpenseService.getArchivedMonths();
      setArchivedMonths(months);
    }
    loadInitialData();
  }, []);

  // Effect to update displayed data when selected month or active data changes
  useEffect(() => {
    async function loadDataForMonth() {
      if (selectedMonth === 'active') {
        setDisplayData({ expenses: activeExpenses, mileageLogs: activeMileageLogs });
      } else {
        const data = await ExpenseService.getExpensesForMonth(selectedMonth);
        setDisplayData({ expenses: data.expenses, mileageLogs: data.mileageLogs });
      }
    }
    loadDataForMonth();
  }, [selectedMonth, activeExpenses, activeMileageLogs]);

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      const monthToArchive = format(new Date(), 'yyyy-MM');
      await ExpenseService.archiveCurrentExpenses(monthToArchive);
      await fetchData(); // Refreshes active expenses and mileage
      const months = await ExpenseService.getArchivedMonths();
      setArchivedMonths(months);
      setSelectedMonth('active');
      toast({
        title: 'Month Archived!',
        description: 'Your expenses for this period have been archived.',
      });
    } catch (error) {
      console.error("Failed to archive expenses:", error);
      toast({
        title: 'Error',
        description: 'There was a problem archiving your expenses.',
        variant: 'destructive',
      });
    } finally {
      setIsArchiving(false);
    }
  };


  const handleExport = () => {
    const { expenses, mileageLogs } = displayData;
    let monthName = 'Active Expenses';
    if (selectedMonth !== 'active') {
        try {
            const date = parse(selectedMonth, 'yyyy-MM', new Date());
            monthName = format(date, 'MMMM yyyy');
        } catch (e) {
            monthName = selectedMonth;
        }
    } else {
        const allDates = [
          ...expenses.map(e => new Date(e.date)),
          ...mileageLogs.map(m => new Date(m.date))
        ];
        if (allDates.length > 0) {
          const mostRecentDate = allDates.reduce((a, b) => a > b ? a : b);
          monthName = format(mostRecentDate, 'MMMM yyyy');
        }
    }
    
    const mileageHeader = ['Date', 'Description', 'Distance (km)', 'Rate', 'Total'];
    const mileageRows = mileageLogs.map(item => [
      format(new Date(item.date), 'yyyy-MM-dd'),
      item.description,
      item.distance,
      item.rate,
      item.distance * item.rate
    ]);

    const creditCardExpenses = expenses.filter(e => e.transferee === 'Work Visa');
    const creditCardHeader = ['Date', 'Description', 'Category', 'Amount', 'Reimbursable'];
    const creditCardRows = creditCardExpenses.map(item => [
      format(new Date(item.date), 'yyyy-MM-dd'),
      item.description,
      item.category,
      item.amount,
      item.reimbursable ? 'Yes' : 'No'
    ]);

    const otherReimbursableExpenses = expenses.filter(e => e.transferee !== 'Work Visa' && e.reimbursable);
    const otherReimbursableHeader = ['Date', 'Description', 'Category', 'Paid From', 'Amount'];
    const otherReimbursableRows = otherReimbursableExpenses.map(item => [
      format(new Date(item.date), 'yyyy-MM-dd'),
      item.description,
      item.category,
      item.transferee,
      item.amount
    ]);
    
    // Create the main header with styling baked in
    const mainHeaderCell = {
      v: `${monthName} Expenses`,
      t: 's',
      s: {
        font: { sz: 20, bold: true },
        alignment: { horizontal: 'center', vertical: 'center' }
      }
    };
    
    const data = [
      [mainHeaderCell], // Main header in A1
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
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data, { cellStyles: true });

    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

    const boldStyle = { font: { bold: true } };
    
    const sectionHeaderRefs = [
        'A3', // Mileage
        `A${5 + mileageRows.length + 1}`, // Credit Card (+1 for the spacer)
        `A${8 + mileageRows.length + creditCardRows.length + 1}` // Other Reimbursable (+1 for spacer)
    ];
    sectionHeaderRefs.forEach(cellRef => {
        if(ws[cellRef]) ws[cellRef].s = boldStyle;
    });

    const mileageHeaderRow = 3;
    mileageHeader.forEach((_, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({c: colIndex, r: mileageHeaderRow});
        if (ws[cellRef]) ws[cellRef].s = boldStyle;
    });
    
    const creditCardHeaderRow = 5 + mileageRows.length + 1; // +1 spacer
    creditCardHeader.forEach((_, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({c: colIndex, r: creditCardHeaderRow});
        if (ws[cellRef]) ws[cellRef].s = boldStyle;
    });

    const otherReimbursableHeaderRow = 8 + mileageRows.length + creditCardRows.length + 1; // +1 spacer
    otherReimbursableHeader.forEach((_, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({c: colIndex, r: otherReimbursableHeaderRow});
        if (ws[cellRef]) ws[cellRef].s = boldStyle;
    });

    const colWidths = [
      { wch: 15 }, // Date
      { wch: 40 }, // Description
      { wch: 15 }, // Category / Distance
      { wch: 15 }, // Amount / Rate
      { wch: 15 }  // Reimbursable / Total
    ];
    ws['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(wb, ws, 'Work Expenses');
    XLSX.writeFile(wb, `work-expenses-${monthName.replace(/\s+/g, '-')}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const totalMonetaryExpenses = displayData.expenses.reduce((acc, item) => acc + item.amount, 0);
  const reimbursableMonetary = displayData.expenses
    .filter((item) => item.reimbursable && item.transferee !== 'Work Visa')
    .reduce((acc, item) => acc + item.amount, 0);
  
  const totalMileageReimbursement = displayData.mileageLogs
    .reduce((acc, item) => acc + (item.distance * item.rate), 0);
    
  const totalReimbursable = reimbursableMonetary + totalMileageReimbursement;
  const isViewingArchive = selectedMonth !== 'active';


  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-8 flex justify-between items-center no-print">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
        <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={isArchiving || (activeExpenses.length === 0 && activeMileageLogs.length === 0)}>
                  <Archive className="mr-2 h-4 w-4" />
                  Start New Month
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archive Current Expenses?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will archive all current active expenses and mileage logs for the current month. You will still be able to view them later. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleArchive} className={cn(buttonVariants({ variant: "default" }))}>
                    Yes, Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
             <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <CalendarClock className="mr-2 h-4 w-4" />
                  View Month
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Select a period</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={selectedMonth} onValueChange={setSelectedMonth}>
                  <DropdownMenuRadioItem value="active">Active Month</DropdownMenuRadioItem>
                  {archivedMonths.map(month => (
                    <DropdownMenuRadioItem key={month} value={month}>
                      {format(parse(month, 'yyyy-MM', new Date()), 'MMMM yyyy')}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" onClick={handleExport} >
                <Download className="mr-2 h-4 w-4" />
                Export to XLSX
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
        </div>
      </header>
      <main>
        <div className="flex justify-between items-center mb-6 gap-2">
            <h2 className="text-3xl font-bold font-headline text-primary">
              {isViewingArchive ? `Work Expenses: ${format(parse(selectedMonth, 'yyyy-MM', new Date()), 'MMMM yyyy')}` : 'Active Work Expenses'}
            </h2>
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
          <TabsList className="grid w-full grid-cols-2 bg-secondary/50 mb-6 no-print">
            <TabsTrigger value="monetary"><Banknote className="mr-2 h-4 w-4" />Monetary Expenses</TabsTrigger>
            <TabsTrigger value="mileage"><Car className="mr-2 h-4 w-4" />Mileage Log</TabsTrigger>
          </TabsList>
          <TabsContent value="monetary">
            <ExpenseTable 
              expenses={displayData.expenses} 
              addExpense={addExpense}
              updateExpense={updateExpense}
              deleteExpense={deleteExpense}
              toggleExpenseCompleted={toggleExpenseCompleted}
              addMileage={addMileage}
              updateMileage={updateMileage}
              isLoading={dataLoading} 
              isArchived={isViewingArchive}
            />
          </TabsContent>
          <TabsContent value="mileage">
            <MileageTable 
              mileageLogs={displayData.mileageLogs} 
              addExpense={addExpense}
              updateExpense={updateExpense}
              addMileage={addMileage}
              updateMileage={updateMileage}
              deleteMileage={deleteMileage}
              isLoading={dataLoading} 
              isArchived={isViewingArchive}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
