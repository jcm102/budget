
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PlusCircle, Pencil, Smartphone, Copy } from 'lucide-react';
import { BudgetTable } from '@/components/budget-table';
import { TransactionForm } from '@/components/transaction-form';
import { useTransactions } from '@/hooks/use-transactions';
import { useMonthlyBudget } from '@/hooks/use-monthly-budget';
import { BudgetBreakdownForm } from '@/components/budget-breakdown-form';
import type { Category, MonthlyBudgetItem, BudgetSubItem, Transaction } from '@/types';
import { useBudget } from '@/hooks/use-budget';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { addMonths, format } from 'date-fns';

export default function MonthlyBudgetPage() {
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [isBreakdownFormOpen, setIsBreakdownFormOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'current' | 'next'>('current');

  const selectedMonth = view === 'current' ? currentDate : addMonths(currentDate, 1);
  const selectedMonthString = format(selectedMonth, 'yyyy-MM');


  const { transactions, accounts, addTransaction, updateTransaction, deleteTransaction, isLoading: isLoadingTransactions } = useTransactions(selectedMonthString);
  const { budgetItems: monthlyBudgetItems, categories, updateBudgetItemWithBreakdown, isLoading: isLoadingBudget, updateBudgetItem, copyBudgetFromPreviousMonth } = useMonthlyBudget(selectedMonthString);
  const { budgetItems, isLoading: isLoadingIncome } = useBudget();

  const incomeAmount = budgetItems
    .filter(i => i.type === 'Income' && !i.forNextMonth)
    .reduce((acc, i) => acc + i.amount, 0);

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


  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };
  
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
            <Button asChild variant="outline" className="md:hidden">
                <Link href="/monthly-budget/mobile">
                    <Smartphone className="mr-2 h-4 w-4" />
                    Mobile View
                </Link>
            </Button>
            <Button onClick={() => handleOpenTransactionForm(null)}>
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
             <Tabs defaultValue="current" className="w-full" onValueChange={(value) => setView(value as 'current' | 'next')}>
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
                />
              </TabsContent>
              <TabsContent value="next">
                 <div className="flex justify-end mb-4">
                    <Button variant="outline" onClick={() => copyBudgetFromPreviousMonth()}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy from Previous Month
                    </Button>
                </div>
                <BudgetTable 
                    budgetItems={monthlyBudgetItems}
                    categories={categories}
                    transactions={transactions}
                    isLoading={isLoadingBudget || isLoadingTransactions || isLoadingIncome}
                    onEditBreakdown={handleEditBreakdown}
                    onEditTransaction={handleOpenTransactionForm}
                    onUpdateBudget={updateBudgetItem}
                />
              </TabsContent>
            </Tabs>
        </main>
      </div>
    </>
  );
}
