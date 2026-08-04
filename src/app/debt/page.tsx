'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DebtTable } from '@/app/debt/components/debt-table';
import { ArrowLeft, Printer, RotateCcw, View, ChevronLeft, ChevronRight, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { useDebt } from '@/app/debt/hooks/use-debt';
import { useState, useMemo, useEffect } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import type { ColumnVisibility } from '@/app/debt/components/debt-table';
import { DebtPlanner } from '@/app/debt/components/debt-planner';
import { useUser } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { format, addMonths, subMonths, parse } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function DebtPage() {
  const { user, isUserLoading } = useUser();
  const [selectedMonthString, setSelectedMonthString] = useState(() => format(new Date(), 'yyyy-MM'));
  const [includeArchived, setIncludeArchived] = useState(false);

  const { debts, resetDebtValues, isLoading, fetchDebts } = useDebt(selectedMonthString);
  
  // Sync archiving settings to hook
  const { setIncludeArchived: syncArchivedSetting } = useDebt(selectedMonthString);
  
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
    scheduled: true,
    paid: true,
    name: true,
    debtType: true,
    balance: true,
    interestRate: true,
    minimumPayment: true,
    plannedPayment: true,
    dueDate: true,
    actions: true,
  });

  const columnConfig = {
    scheduled: { label: 'Scheduled' },
    paid: { label: 'Paid' },
    name: { label: 'Debt Name' },
    debtType: { label: 'Type'},
    balance: { label: 'Balance', isNumeric: true },
    interestRate: { label: 'Rate', isNumeric: true },
    minimumPayment: { label: 'Min. Payment', isNumeric: true },
    plannedPayment: { label: 'Planned Payment', isNumeric: true },
    dueDate: { label: 'Due Date' },
    actions: { label: 'Actions', isAction: true },
  };

  const handlePrevMonth = () => {
    const d = parse(selectedMonthString + '-01', 'yyyy-MM-dd', new Date());
    setSelectedMonthString(format(subMonths(d, 1), 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const d = parse(selectedMonthString + '-01', 'yyyy-MM-dd', new Date());
    setSelectedMonthString(format(addMonths(d, 1), 'yyyy-MM'));
  };

  const handleOpenScheduleWindow = () => {
    window.open(`/debt/schedule?month=${selectedMonthString}`, '_blank', 'width=1000,height=800');
  };

  if (isLoading || isUserLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8">
       <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>

        {/* Month Selector Group */}
        <div className="flex items-center gap-2 bg-secondary/30 p-1.5 rounded-lg border border-border/80">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="h-9 w-9">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input 
            type="month" 
            value={selectedMonthString} 
            onChange={(e) => e.target.value && setSelectedMonthString(e.target.value)} 
            className="w-[160px] h-9 text-center font-medium border-0 focus-visible:ring-0 bg-transparent cursor-pointer"
          />
          <Button variant="ghost" size="icon" onClick={handleNextMonth} className="h-9 w-9">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
            {/* Archived Switch */}
            <div className="flex items-center space-x-2 bg-card border px-3 py-1.5 rounded-md text-sm mr-2 shadow-sm">
              <Switch 
                id="archived-switch" 
                checked={includeArchived} 
                onCheckedChange={setIncludeArchived}
              />
              <Label htmlFor="archived-switch" className="cursor-pointer font-medium flex items-center gap-1.5">
                {includeArchived ? <Eye className="h-4 w-4 text-amber-600" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                Show Archived
              </Label>
            </div>

            <Button variant="outline" onClick={handleOpenScheduleWindow}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open Schedule View
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={debts.length === 0}>
                  <RotateCcw className="mr-2 h-5 w-5" />
                  Reset {format(parse(selectedMonthString + '-01', 'yyyy-MM-dd', new Date()), 'MMMM')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will reset the balance, payments, and due date for ALL debts in the currently selected month ({format(parse(selectedMonthString + '-01', 'yyyy-MM-dd', new Date()), 'MMMM yyyy')}). This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={resetDebtValues} className={cn(buttonVariants({ variant: "destructive" }))}>
                    Yes, Reset Month
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <View className="mr-2 h-4 w-4" />
                  View
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                <DropdownMenuLabel>Toggle Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(columnConfig).map(([key, { label }]) => (
                   <DropdownMenuCheckboxItem
                    key={key}
                    className="capitalize"
                    checked={columnVisibility[key as keyof ColumnVisibility]}
                    onCheckedChange={(value) =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        [key]: !!value,
                       }))
                    }
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
        </div>
      </header>
      <main>
        <div className="bg-card/50 p-4 border rounded-xl shadow-inner mb-8">
          <h2 className="text-xl font-bold mb-4 flex items-center justify-between">
            <span>Worksheet for {format(parse(selectedMonthString + '-01', 'yyyy-MM-dd', new Date()), 'MMMM yyyy')}</span>
          </h2>
          <DebtTable
              month={selectedMonthString}
              includeArchived={includeArchived}
              columnVisibility={columnVisibility}
              columnConfig={columnConfig}
          />
        </div>
        <div className="mt-12">
            <DebtPlanner debts={debts} month={selectedMonthString} onRefresh={fetchDebts} />
        </div>
      </main>
    </div>
  );
}
