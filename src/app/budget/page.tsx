'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Printer, Banknote, Wallet, Clock, ArrowRightLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { useBudget } from '@/app/budget/hooks/use-budget';
import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { IncomeTable } from '@/app/budget/components/income-table';
import { PaPaymentsTable } from '@/app/budget/components/pa-payments-table';
import { TransfersTable } from '@/app/budget/components/transfers-table';
import { Skeleton } from '@/components/ui/skeleton';
import { DebtPaymentsTable } from '@/app/budget/components/debt-payments-table';
import { PendingPaymentsModal } from '@/app/budget/components/pending-payments-modal';
import { format, addMonths, subMonths, parse } from 'date-fns';
import { Input } from '@/components/ui/input';
import { useAccountDetails } from '@/hooks/use-transferees';
import { useDebt } from '@/app/debt/hooks/use-debt';

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export default function BudgetPage() {
  const [selectedMonthString, setSelectedMonthString] = useState(() => format(new Date(), 'yyyy-MM'));
  const { budgetItems, updateBudgetItem, deleteBudgetItem, toggleBudgetItemCompleted, isLoading, fetchBudgetItems } = useBudget(selectedMonthString);
  const { accounts, isLoading: isLoadingAccounts } = useAccountDetails();
  const { debts, isLoading: isLoadingDebts } = useDebt();

  const enrichedAccounts = useMemo(() => {
    return accounts.map(acc => {
      if (acc.type === 'Credit' && acc.linkedDebtId) {
        const linkedDebt = debts.find(d => d.id === acc.linkedDebtId);
        return { ...acc, debtBalance: linkedDebt?.balance || 0 };
      }
      return acc;
    });
  }, [accounts, debts]);

  const libroChequing = enrichedAccounts.find(a => a.name === 'Libro Chequing');
  const wealthsimpleMastercard = enrichedAccounts.find(a => a.name === 'Wealthsimple Mastercard');
  const eqBankCard = enrichedAccounts.find(a => a.name === 'EQ Bank Mastercard') || enrichedAccounts.find(a => a.name === 'EQ Card');

  const unrealizedIncome = useMemo(() => {
    if (!libroChequing) return 0;
    return budgetItems
      .filter(item => 
        item.type === 'Income' && 
        !item.completed && 
        (!item.destinationAccountId || item.destinationAccountId === libroChequing.id) &&
        !item.isNextMonthView
      )
      .reduce((sum, item) => sum + item.amount, 0);
  }, [budgetItems, libroChequing]);

  const getBalance = (account: any) => {
    if (!account) return 0;
    return account.type === 'Credit' ? (account.debtBalance || account.balance || 0) : (account.balance || 0);
  };
  
  const handlePrint = () => {
    window.print();
  };

  const handlePrevMonth = () => {
    const d = parse(selectedMonthString + '-01', 'yyyy-MM-dd', new Date());
    setSelectedMonthString(format(subMonths(d, 1), 'yyyy-MM'));
  };

  const handleNextMonth = () => {
    const d = parse(selectedMonthString + '-01', 'yyyy-MM-dd', new Date());
    setSelectedMonthString(format(addMonths(d, 1), 'yyyy-MM'));
  };

  const totalIncome = budgetItems.filter(i => i.type === 'Income' && !i.isNextMonthView).reduce((acc, i) => acc + i.amount, 0);
  const totalDebtPayments = budgetItems.filter(i => i.type === 'Debt Payments' && !i.isNextMonthView).reduce((acc, i) => acc + i.amount, 0);
  const totalTransfers = budgetItems.filter(i => i.type === 'Transfers' && !i.isNextMonthView).reduce((acc, i) => acc + i.amount, 0);
  const remainingPAPayments = budgetItems
    .filter(i => i.type === 'Pre-Authorized Payments' && !i.completed && !i.isNextMonthView)
    .reduce((acc, i) => acc + i.amount, 0);

  const renderSummarySkeleton = () => (
    Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="p-4 border rounded-lg bg-card">
        <Skeleton className="h-5 w-24 mb-2" />
        <Skeleton className="h-7 w-32" />
      </div>
    ))
  );

  const selectedMonthLabel = format(parse(selectedMonthString + '-01', 'yyyy-MM-dd', new Date()), 'MMMM yyyy');

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">

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
            <h2 className="text-3xl font-bold font-headline text-primary mb-6">Budget Overview for {selectedMonthLabel}</h2>
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

             <div className="mb-8">
                 <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Key Account Balances</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     {isLoadingAccounts || isLoadingDebts ? (
                         <>
                             <Skeleton className="h-[92px] w-full" />
                             <Skeleton className="h-[92px] w-full" />
                             <Skeleton className="h-[92px] w-full" />
                         </>
                     ) : (
                         <>
                             {libroChequing ? (
                                 <Link href={`/accounts/${libroChequing.id}?from=budget`} className="block">
                                     <div className="p-4 border rounded-lg bg-card hover:bg-accent transition-colors flex flex-col justify-between shadow-sm h-full">
                                         <h4 className="text-muted-foreground text-sm font-medium">Libro Chequing</h4>
                                         <div className="grid grid-cols-2 gap-4 mt-2">
                                              <div>
                                                  <span className="text-xs text-muted-foreground block">Actual</span>
                                                  <span className="text-xl font-bold text-primary">{formatCurrency(getBalance(libroChequing))}</span>
                                              </div>
                                              <div>
                                                  <span className="text-xs text-muted-foreground block">Book</span>
                                                  <span className="text-xl font-bold text-primary">{formatCurrency(getBalance(libroChequing) + unrealizedIncome)}</span>
                                              </div>
                                          </div>
                                     </div>
                                 </Link>
                             ) : (
                                 <div className="p-4 border rounded-lg bg-card flex flex-col justify-between shadow-sm opacity-50">
                                     <h4 className="text-muted-foreground text-sm font-medium">Libro Chequing</h4>
                                     <p className="text-2xl font-bold mt-2 text-primary">{formatCurrency(0)}</p>
                                 </div>
                             )}
                             {wealthsimpleMastercard ? (
                                 <Link href={`/accounts/${wealthsimpleMastercard.id}?from=budget`} className="block">
                                     <div className="p-4 border rounded-lg bg-card hover:bg-accent transition-colors flex flex-col justify-between shadow-sm h-full">
                                         <h4 className="text-muted-foreground text-sm font-medium">Wealthsimple Mastercard</h4>
                                         <p className="text-2xl font-bold mt-2 text-primary">{formatCurrency(getBalance(wealthsimpleMastercard))}</p>
                                     </div>
                                 </Link>
                             ) : (
                                 <div className="p-4 border rounded-lg bg-card flex flex-col justify-between shadow-sm opacity-50">
                                     <h4 className="text-muted-foreground text-sm font-medium">Wealthsimple Mastercard</h4>
                                     <p className="text-2xl font-bold mt-2 text-primary">{formatCurrency(0)}</p>
                                 </div>
                             )}
                             {eqBankCard ? (
                                 <Link href={`/accounts/${eqBankCard.id}?from=budget`} className="block">
                                     <div className="p-4 border rounded-lg bg-card hover:bg-accent transition-colors flex flex-col justify-between shadow-sm h-full">
                                         <h4 className="text-muted-foreground text-sm font-medium">{eqBankCard.name}</h4>
                                         <p className="text-2xl font-bold mt-2 text-primary">{formatCurrency(getBalance(eqBankCard))}</p>
                                     </div>
                                 </Link>
                             ) : (
                                 <div className="p-4 border rounded-lg bg-card flex flex-col justify-between shadow-sm opacity-50">
                                     <h4 className="text-muted-foreground text-sm font-medium">EQ Bank Card</h4>
                                     <p className="text-2xl font-bold mt-2 text-primary">{formatCurrency(0)}</p>
                                 </div>
                             )}
                         </>
                     )}
                 </div>
             </div>

              <Tabs defaultValue="income" className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-secondary/50 mb-6 no-print h-auto">
                    <TabsTrigger value="income" className="py-2"><Banknote className="mr-2 h-4 w-4"/>Income</TabsTrigger>
                    <TabsTrigger value="debt" className="py-2"><Wallet className="mr-2 h-4 w-4"/>Debt Payments</TabsTrigger>
                    <TabsTrigger value="pa" className="py-2"><Clock className="mr-2 h-4 w-4"/>PA Payments</TabsTrigger>
                    <TabsTrigger value="transfers" className="py-2"><ArrowRightLeft className="mr-2 h-4 w-4"/>Transfers</TabsTrigger>
                </TabsList>
                
                <TabsContent value="income">
                    <h3 className="text-2xl font-bold font-headline text-primary mb-6">Income</h3>
                    <IncomeTable month={selectedMonthString} onMutation={fetchBudgetItems} />
                </TabsContent>
                <TabsContent value="debt">
                    <DebtPaymentsTable month={selectedMonthString} onMutation={fetchBudgetItems} />
                </TabsContent>
                <TabsContent value="pa">
                    <PaPaymentsTable month={selectedMonthString} onMutation={fetchBudgetItems} />
                </TabsContent>
                <TabsContent value="transfers">
                    <h3 className="text-2xl font-bold font-headline text-primary mb-6">Transfers</h3>
                    <TransfersTable month={selectedMonthString} onMutation={fetchBudgetItems} />
                </TabsContent>
            </Tabs>
        </div>
      </main>

      <PendingPaymentsModal
        budgetItems={budgetItems}
        onMarkPaid={async (id) => {
          await toggleBudgetItemCompleted(id, false);
        }}
        onSkip={deleteBudgetItem}
        onClose={fetchBudgetItems}
      />
    </div>
  );
}
