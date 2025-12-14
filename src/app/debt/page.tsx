
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DebtTable } from '@/app/debt/components/debt-table';
import { ArrowLeft, Printer, RotateCcw, View, CalendarClock } from 'lucide-react';
import { useDebt } from '@/app/debt/hooks/use-debt';
import { useState } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ColumnVisibility } from '@/app/debt/components/debt-table';
import { DebtSnowballCalculator } from '@/app/debt/components/debt-snowball-calculator';
import { useUser } from '@/firebase';
import { Loader2 } from 'lucide-react';

export default function DebtPage() {
  const { user, isUserLoading } = useUser();
  const { debts, cycleToNextMonth, resetDebtValues, isLoading } = useDebt();
  
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>({
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

  const handlePrint = () => {
    window.print();
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
       <header className="mb-8 flex justify-between items-center no-print">
        <Button asChild variant="outline">
          <Link href="/tasks">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tasks
          </Link>
        </Button>
         <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={debts.length === 0}>
                  <CalendarClock className="mr-2 h-5 w-5" />
                  Cycle to Next Month
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cycle to Next Month?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will replace all "Current Month" data with the "Next Month" data you've entered. The "Next Month" fields will then be cleared. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={cycleToNextMonth} className={cn(buttonVariants({ variant: "default" }))}>
                    Yes, Cycle Month
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={debts.length === 0}>
                  <RotateCcw className="mr-2 h-5 w-5" />
                  Reset All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will reset the balance, payments, and due date for ALL debts in BOTH the current and next month tabs. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={resetDebtValues} className={cn(buttonVariants({ variant: "destructive" }))}>
                    Yes, Reset All
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
            <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
            </Button>
        </div>
      </header>
      <main>
         <Tabs defaultValue="current" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-secondary/50 mb-6 no-print">
            <TabsTrigger value="current">Current Month</TabsTrigger>
            <TabsTrigger value="next">Next Month</TabsTrigger>
          </TabsList>
          <TabsContent value="current">
            <DebtTable
                view="current"
                columnVisibility={columnVisibility}
                columnConfig={columnConfig}
            />
          </TabsContent>
          <TabsContent value="next">
             <DebtTable
                view="next"
                columnVisibility={columnVisibility}
                columnConfig={columnConfig}
            />
          </TabsContent>
        </Tabs>
        <div className="mt-12">
            <DebtSnowballCalculator debts={debts} />
        </div>
      </main>
    </div>
  );
}
