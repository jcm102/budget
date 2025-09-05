
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Printer, ChevronsUpDown, Banknote, Wallet, Clock, ArrowRightLeft, Calendar } from 'lucide-react';
import { useBudget } from '@/hooks/use-budget';
import { useToast } from '@/hooks/use-toast';
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
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';
import { PaymentCalendar } from '@/components/payment-calendar';
import { useDebt } from '@/hooks/use-debt';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IncomeTable } from '@/components/income-table';
import { PaPaymentsTable } from '@/components/pa-payments-table';
import { TransfersTable } from '@/components/transfers-table';
import { Skeleton } from '@/components/ui/skeleton';
import { DebtPaymentsTable } from '@/components/debt-payments-table';


export default function BudgetPage() {
  const { budgetItems, isLoading, fetchBudgetItems } = useBudget();
  
  const handlePrint = () => {
    window.print();
  }

  const totalIncome = budgetItems.filter(i => i.type === 'Income').reduce((acc, i) => acc + i.amount, 0);
  const totalDebtPayments = budgetItems.filter(i => i.type === 'Debt Payments').reduce((acc, i) => acc + i.amount, 0);
  const totalTransfers = budgetItems.filter(i => i.type === 'Transfers').reduce((acc, i) => acc + i.amount, 0);
  const remainingPAPayments = budgetItems
    .filter(i => i.type === 'Pre-Authorized Payments' && !i.completed)
    .reduce((acc, i) => acc + i.amount, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const renderSummarySkeleton = () => (
    Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="p-4 border rounded-lg bg-card">
        <Skeleton className="h-5 w-24 mb-2" />
        <Skeleton className="h-7 w-32" />
      </div>
    ))
  );

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-8 flex justify-between items-center no-print">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tasks
          </Link>
        </Button>
        <div className="flex gap-2">
            <Button variant="outline" onClick={() => fetchBudgetItems()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
            </Button>
            <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
            </Button>
        </div>
      </header>
      <main className="space-y-8">
        <div>
            <h2 className="text-3xl font-bold font-headline text-primary mb-6">Budget Overview</h2>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {isLoading ? renderSummarySkeleton() : (
                    <>
                        <div className="p-4 border rounded-lg bg-card">
                            <h4 className="text-muted-foreground">Total Income</h4>
                            <p className="text-2xl font-semibold">{formatCurrency(totalIncome)}</p>
                        </div>
                        <div className="p-4 border rounded-lg bg-card">
                            <h4 className="text-muted-foreground">Total Debt Payments</h4>
                            <p className="text-2xl font-semibold">{formatCurrency(totalDebtPayments)}</p>
                        </div>
                         <div className="p-4 border rounded-lg bg-card">
                            <h4 className="text-muted-foreground">Total Transfers</h4>
                            <p className="text-2xl font-semibold">{formatCurrency(totalTransfers)}</p>
                        </div>
                        <div className="p-4 border rounded-lg bg-card">
                            <h4 className="text-muted-foreground">Remaining PA Payments</h4>
                            <p className="text-2xl font-semibold">{formatCurrency(remainingPAPayments)}</p>
                        </div>
                    </>
                )}
            </div>

             <Tabs defaultValue="income" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-secondary/50 mb-6 no-print h-auto">
                    <TabsTrigger value="income" className="py-2"><Banknote className="mr-2 h-4 w-4"/>Income</TabsTrigger>
                    <TabsTrigger value="debt" className="py-2"><Wallet className="mr-2 h-4 w-4"/>Debt Payments</TabsTrigger>
                    <TabsTrigger value="pa" className="py-2"><Clock className="mr-2 h-4 w-4"/>PA Payments</TabsTrigger>
                    <TabsTrigger value="transfers" className="py-2"><ArrowRightLeft className="mr-2 h-4 w-4"/>Transfers</TabsTrigger>
                </TabsList>
                
                <TabsContent value="income">
                    <IncomeTable />
                </TabsContent>
                <TabsContent value="debt">
                    <DebtPaymentsTable />
                </TabsContent>
                <TabsContent value="pa">
                    <PaPaymentsTable />
                </TabsContent>
                <TabsContent value="transfers">
                    <TransfersTable />
                </TabsContent>
            </Tabs>
        </div>
      </main>
    </div>
  );
}
