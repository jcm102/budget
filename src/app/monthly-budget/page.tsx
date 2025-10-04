
'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PlusCircle, Smartphone, Copy, CalendarClock } from 'lucide-react';
import { BudgetTable } from './components/budget-table';
import { TransactionForm } from './components/transaction-form';
import { useTransactions } from './hooks/use-transactions';
import { useMonthlyBudget } from './hooks/use-monthly-budget';
import { BudgetBreakdownForm } from './components/budget-breakdown-form';
import type { Category, MonthlyBudgetItem, BudgetSubItem, Transaction } from '@/types';
import { useBudget } from '@/app/budget/hooks/use-budget';
import { format, addMonths } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export default function MonthlyBudgetPage() {
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [isBreakdownFormOpen, setIsBreakdownFormOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [view, setView] = useState<'current' | 'next'>('current');
  
  const currentDate = new Date();
  const currentMonthString = format(currentDate, 'yyyy-MM');
  const nextMonthString = format(addMonths(currentDate, 1), 'yyyy-MM');
  const selectedMonthString = view === 'current' ? currentMonthString : nextMonthString;

  const { transactions, accounts, addTransaction, updateTransaction, deleteTransaction, isLoading: isLoadingTransactions } = useTransactions(selectedMonthString);
  const { budgetItems: monthlyBudgetItems, categories, updateBudgetItemWithBreakdown, isLoading: isLoadingBudget, updateBudgetItem, copyCategoryFromPreviousMonth, cycleToNextMonth } = useMonthlyBudget(selectedMonthString);
  const { budgetItems: incomeItems, isLoading: isLoadingIncome } = useBudget();

  const incomeAmount = useMemo(() => {
    const relevantIncome = view === 'next'
      ? incomeItems.filter(i => i.type === 'Income' && i.forNextMonth)
      : incomeItems.filter(i => i.type === 'Income' && !i.forNextMonth);
      
    return relevantIncome.reduce((acc, i) => acc + i.amount, 0);
  }, [incomeItems, view]);


  const totalBudgeted = monthlyBudgetItems.reduce((acc, item) => acc + item.budgeted, 0);
  
  const selectedBudgetItem = selectedCategory 
    ? monthlyBudgetItems.find(b => b.categoryId === selectedCategory.id) 
    : null;

  const handleEditBreakdown = (category: Category) => {
    setSelectedCategory(category);
    setIsBreakdownFormOpen(true);
  }

  const handleSaveBreakdown = (categoryId: string, breakdown: BudgetSubItem[]) => {
    updateBudgetItemWithBreakdown(categoryId, breakdown);
  }
  
  const handleOpenTransactionForm = (transaction: Transaction | null) => {
    setEditingTransaction(transaction);
    setIsTransactionFormOpen(true);
  };
  
  const handleCloseTransactionForm = (isOpen: boolean) => {
    if (!isOpen) {
        setEditingTransaction(null);
    }
    setIsTransactionFormOpen(isOpen);
  }

  const leftToBudget = incomeAmount - totalBudgeted;

  return (
    <>
      <TransactionForm
        open={isTransactionFormOpen}
        onOpenChange={handleCloseTransactionForm}
        accounts={accounts}
        addTransaction={addTransaction}
        updateTransaction={updateTransaction}
        deleteTransaction={deleteTransaction}
        editingTransaction={editingTransaction}
      />
      <BudgetBreakdownForm
        open={isBreakdownFormOpen}
        onOpenChange={setIsBreakdownFormOpen}
        onSave={handleSaveBreakdown}
        category={selectedCategory}
        budgetItem={selectedBudgetItem}
      />
      <div className="container mx-auto max-w-4xl p-4 md:p-8">
        <header className="mb-8 flex justify-between items-center">
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
           <div className="flex items-center gap-2">
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Cycle to Next Month
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cycle to Next Month?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will finalize your planned budget, making it the current month's budget and clearing the plan for next month. This action cannot be undone.
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
            <Button asChild variant="outline" className="md:hidden">
                <Link href="/monthly-budget/add">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Transaction
                </Link>
            </Button>
            <Button onClick={() => handleOpenTransactionForm(null)} className="hidden md:inline-flex">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Transaction
            </Button>
           </div>
        </header>
        <main className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold font-headline text-primary mb-2">Monthly Budget</h1>
                 <p className="text-muted-foreground mt-2 text-lg">
                    Give every dollar a job. Set your income, budget your categories, and track your spending.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <Link href="/budget">
                    <div 
                    className="p-4 border rounded-lg bg-card cursor-pointer hover:bg-accent transition-colors h-full"
                    >
                        <div className="flex justify-between items-center">
                        <h4 className="text-muted-foreground">Budgeted Income</h4>
                        </div>
                        <p className="text-2xl font-semibold">{formatCurrency(incomeAmount)}</p>
                    </div>
                 </Link>
                <div className="p-4 border rounded-lg bg-card">
                    <h4 className="text-muted-foreground">Amount Budgeted</h4>
                    <p className="text-2xl font-semibold">{formatCurrency(totalBudgeted)}</p>
                </div>
                <div className="p-4 border rounded-lg bg-card">
                    <h4 className="text-muted-foreground">Left to Budget</h4>
                    <p className={`text-2xl font-semibold ${leftToBudget < 0 ? 'text-destructive' : ''}`}>
                      {formatCurrency(leftToBudget)}
                    </p>
                </div>
            </div>
            <Tabs value={view} onValueChange={(value) => setView(value as 'current' | 'next')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-secondary/50 mb-6 no-print">
                    <TabsTrigger value="current">Current Month</TabsTrigger>
                    <TabsTrigger value="next">Next Month</TabsTrigger>
                </TabsList>
                <TabsContent value="current">
                     <BudgetTable 
                        budgetItems={monthlyBudgetItems}
                        categories={categories}
                        transactions={transactions}
                        isLoading={isLoadingBudget || isLoadingTransactions || isLoadingIncome}
                        onEditBreakdown={handleEditBreakdown}
                        onEditTransaction={handleOpenTransactionForm}
                        onUpdateBudget={updateBudgetItem}
                        onCopyCategory={copyCategoryFromPreviousMonth}
                        view={view}
                    />
                </TabsContent>
                <TabsContent value="next">
                     <BudgetTable 
                        budgetItems={monthlyBudgetItems}
                        categories={categories}
                        transactions={transactions}
                        isLoading={isLoadingBudget || isLoadingTransactions || isLoadingIncome}
                        onEditBreakdown={handleEditBreakdown}
                        onEditTransaction={handleOpenTransactionForm}
                        onUpdateBudget={updateBudgetItem}
                        onCopyCategory={copyCategoryFromPreviousMonth}
                        view={view}
                    />
                </TabsContent>
            </Tabs>
        </main>
      </div>
    </>
  );
}
