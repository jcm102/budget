
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BudgetTable } from '@/components/budget-table';
import { TransactionTable } from '@/components/transaction-table';
import { TransactionForm } from '@/components/transaction-form';
import { useTransactions } from '@/hooks/use-transactions';
import { useMonthlyBudget } from '@/hooks/use-monthly-budget';

export default function MonthlyBudgetPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const { transactions, addTransaction, isLoading: isLoadingTransactions } = useTransactions();
  const { budgetItems, isLoading: isLoadingBudget } = useMonthlyBudget();

  const totalBudgeted = budgetItems.reduce((acc, item) => acc + item.budgeted, 0);
  const totalSpent = transactions.reduce((acc, item) => acc + item.amount, 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  return (
    <>
      <TransactionForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        addTransaction={addTransaction}
      />
      <div className="container mx-auto max-w-4xl p-4 md:p-8">
        <header className="mb-8 flex justify-between items-center">
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
           <Button onClick={() => setIsFormOpen(true)}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add Transaction
            </Button>
        </header>
        <main className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-headline text-primary mb-2">Monthly Budget</h1>
                 <p className="text-muted-foreground mt-2 text-lg">
                    Set your budget, track your spending, and stay on top of your finances.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg bg-card">
                    <h4 className="text-muted-foreground">Total Budgeted</h4>
                    <p className="text-2xl font-semibold">{formatCurrency(totalBudgeted)}</p>
                </div>
                <div className="p-4 border rounded-lg bg-card">
                    <h4 className="text-muted-foreground">Total Spent</h4>
                    <p className="text-2xl font-semibold">{formatCurrency(totalSpent)}</p>
                </div>
                <div className="p-4 border rounded-lg bg-card">
                    <h4 className="text-muted-foreground">Remaining</h4>
                    <p className="text-2xl font-semibold">{formatCurrency(totalBudgeted - totalSpent)}</p>
                </div>
            </div>

            <Tabs defaultValue="budget" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="budget">Budget</TabsTrigger>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                </TabsList>
                <TabsContent value="budget">
                    <BudgetTable />
                </TabsContent>
                <TabsContent value="transactions">
                    <TransactionTable />
                </TabsContent>
            </Tabs>
        </main>
      </div>
    </>
  );
}
