
'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PlusCircle, Smartphone, Copy, CalendarClock } from 'lucide-react';
import { BudgetTable } from './components/budget-table';
import { TransactionForm } from './components/transaction-form';
import { useTransactions } from './hooks/use-transactions';
import { useMonthlyBudget } from './hooks/use-monthly-budget';
import { BudgetBreakdownForm } from './components/budget-breakdown-form';
import type { Category, MonthlyBudgetItem, BudgetSubItem, Transaction, BudgetItem, AccountDetails } from '@/types';
import { useBudget } from '@/app/budget/hooks/use-budget';
import { format, addMonths, subMonths } from 'date-fns';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { PieChart, Pie, Cell } from "recharts"
import { ApplyBudgetDialog } from './components/apply-budget-dialog';


const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const DonutChartCard = ({ title, data, config, total, description }: { title: string, data: any[], config: any, total: number, description: string }) => {
    return (
        <Card className="flex flex-col">
            <CardHeader className="items-center pb-0">
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 pb-0">
                <ChartContainer
                    config={config}
                    className="mx-auto aspect-square h-[200px]"
                >
                    <PieChart>
                        <ChartTooltip
                            cursor={false}
                            content={<ChartTooltipContent hideLabel />}
                        />
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={60}
                            strokeWidth={5}
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                        </Pie>
                    </PieChart>
                </ChartContainer>
            </CardContent>
            <CardFooter className="flex-col gap-2 text-sm">
                <div className="flex items-center gap-2 font-medium leading-none">
                    Total: {formatCurrency(total)}
                </div>
            </CardFooter>
        </Card>
    )
}

export default function MonthlyBudgetPage() {
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [isBreakdownFormOpen, setIsBreakdownFormOpen] = useState(false);
  const [isApplyBudgetFormOpen, setIsApplyBudgetFormOpen] = useState(false);
  const [applyBudgetData, setApplyBudgetData] = useState<{ categoryId: string, categoryName: string, amount: number, budgetItemName?: string } | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [view, setView] = useState<'current' | 'next' | 'previous'>('current');
  const [groupBy, setGroupBy] = useState<'category' | 'source'>('category');
  
  const currentDate = new Date();
  const currentMonthString = format(currentDate, 'yyyy-MM');
  const nextMonthString = format(addMonths(currentDate, 1), 'yyyy-MM');
  const previousMonthString = format(subMonths(currentDate, 1), 'yyyy-MM');

  const selectedMonthString = useMemo(() => {
    if (view === 'next') return nextMonthString;
    if (view === 'previous') return previousMonthString;
    return currentMonthString;
  }, [view, currentMonthString, nextMonthString, previousMonthString]);

  const { transactions, accounts, addTransaction, updateTransaction, deleteTransaction, isLoading: isLoadingTransactions } = useTransactions(selectedMonthString);
  const { budgetItems: monthlyBudgetItems, categories, updateBudgetItemWithBreakdown, isLoading: isLoadingBudget, updateBudgetItem, copyCategoryFromPreviousMonth, copyBudgetItemToNextMonth, cycleToNextMonth } = useMonthlyBudget(selectedMonthString);
  const { budgetItems, isLoading: isLoadingIncome } = useBudget();
  
  const { incomeAmount, paPaymentCategoryIds } = useMemo(() => {
    const relevantIncome = view === 'next'
      ? budgetItems.filter(i => i.type === 'Income' && i.forNextMonth)
      : budgetItems.filter(i => i.type === 'Income' && !i.forNextMonth);
    
    const paItems = budgetItems.filter(i => i.type === 'Pre-Authorized Payments');
    const paIds = new Set(paItems.map(item => item.budgetCategoryId).filter(id => !!id));
      
    return {
      incomeAmount: relevantIncome.reduce((acc, i) => acc + i.amount, 0),
      paPaymentCategoryIds: paIds,
    }
  }, [budgetItems, view]);


  const totalBudgeted = monthlyBudgetItems.reduce((acc, item) => acc + item.budgeted, 0);

  const totalSpent = useMemo(() => {
    return transactions.reduce((acc, tx) => {
        const expenseSplitsTotal = tx.splits
            .filter(split => {
                const isExpense = split.type === 'expense';
                // Exclude if the category is linked to a Pre-Authorized Payment
                const isPAPayment = split.categoryId ? paPaymentCategoryIds.has(split.categoryId) : false;
                return isExpense && !isPAPayment;
            })
            .reduce((sum, split) => sum + split.amount, 0);
        return acc + expenseSplitsTotal;
    }, 0);
  }, [transactions, paPaymentCategoryIds]);
  
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

  const handleApplyBudget = useCallback((categoryId: string, categoryName: string, amount: number, budgetItemName?: string) => {
    setApplyBudgetData({ categoryId, categoryName, amount, budgetItemName });
    setIsApplyBudgetFormOpen(true);
  }, []);

  const handleConfirmApplyBudget = useCallback(async (sourceAccountId: string) => {
    if (!applyBudgetData) return;
    
    const { categoryId, categoryName, amount, budgetItemName } = applyBudgetData;
    
    const transactionData = {
      description: categoryName,
      amount: amount,
      date: new Date().toISOString(),
      sourceAccountId,
      splits: [
        {
          id: crypto.randomUUID(),
          type: 'expense' as const,
          amount: amount,
          categoryId: categoryId,
          budgetItemName: budgetItemName
        }
      ],
    };
    await addTransaction(transactionData);
    setIsApplyBudgetFormOpen(false);
    setApplyBudgetData(null);
  }, [applyBudgetData, addTransaction]);


  const leftToBudget = incomeAmount - totalBudgeted;
  const remainingInBudget = totalBudgeted - totalSpent;

  const incomeChartData = [
      { name: "Budgeted", value: totalBudgeted, fill: "hsl(var(--primary))" },
      { name: "Left to Budget", value: Math.max(0, leftToBudget), fill: "hsl(var(--secondary))" },
  ];
  const incomeChartConfig = {
      Budgeted: { label: "Budgeted", color: "hsl(var(--primary))" },
      "Left to Budget": { label: "Left to Budget", color: "hsl(var(--secondary))" },
  }

  const spentChartData = [
      { name: "Spent", value: totalSpent, fill: "hsl(var(--primary))" },
      { name: "Remaining", value: Math.max(0, remainingInBudget), fill: "hsl(var(--secondary))" },
  ];
  const spentChartConfig = {
      Spent: { label: "Spent", color: "hsl(var(--primary))" },
      Remaining: { label: "Remaining", color: "hsl(var(--secondary))" },
  }


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
        accounts={accounts}
      />
       {applyBudgetData && (
        <ApplyBudgetDialog
          open={isApplyBudgetFormOpen}
          onOpenChange={setIsApplyBudgetFormOpen}
          categoryName={applyBudgetData.categoryName}
          amount={applyBudgetData.amount}
          accounts={accounts}
          onConfirm={handleConfirmApplyBudget}
        />
      )}
      <div className="container mx-auto max-w-6xl p-4 md:p-8">
        <header className="mb-8 flex justify-between items-center">
          <Button asChild variant="outline">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Link>
          </Button>
            <div className="flex items-center gap-2">
              <div className="flex items-center border rounded-md p-1 bg-secondary/30 gap-1 text-xs no-print">
                <Button
                  variant={groupBy === 'category' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 py-1 px-3 text-xs font-semibold"
                  onClick={() => setGroupBy('category')}
                >
                  By Category
                </Button>
                <Button
                  variant={groupBy === 'source' ? 'default' : 'ghost'}
                  size="sm"
                  className="h-8 py-1 px-3 text-xs font-semibold"
                  onClick={() => setGroupBy('source')}
                >
                  By Payment Source
                </Button>
              </div>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 <DonutChartCard
                    title="Budgeted Income"
                    description={view === 'current' ? `Total income for ${format(currentDate, "MMMM")}` : `Planned income for ${format(addMonths(currentDate, 1), "MMMM")}`}
                    data={incomeChartData}
                    config={incomeChartConfig}
                    total={incomeAmount}
                />
                 <DonutChartCard
                    title="Amount Budgeted"
                    description="Total planned spending for the month"
                    data={spentChartData}
                    config={spentChartConfig}
                    total={totalBudgeted}
                />
                 <Card className="flex flex-col justify-center items-center">
                    <CardHeader>
                        <CardTitle>Left to Budget</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className={`text-3xl font-semibold ${leftToBudget < 0 ? 'text-destructive' : ''}`}>{formatCurrency(leftToBudget)}</p>
                    </CardContent>
                </Card>
                <Card className="flex flex-col justify-center items-center">
                    <CardHeader>
                        <CardTitle>Remaining in Budget</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className={`text-3xl font-semibold ${remainingInBudget < 0 ? 'text-destructive' : ''}`}>{formatCurrency(remainingInBudget)}</p>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={view} onValueChange={(value) => setView(value as 'previous' | 'current' | 'next')} className="w-full">
                <TabsList className="grid w-full grid-cols-3 bg-secondary/50 mb-6 no-print">
                    <TabsTrigger value="previous">Previous Month</TabsTrigger>
                    <TabsTrigger value="current">Current Month</TabsTrigger>
                    <TabsTrigger value="next">Next Month</TabsTrigger>
                </TabsList>
                <TabsContent value="previous">
                     <BudgetTable 
                        budgetItems={monthlyBudgetItems}
                        categories={categories}
                        transactions={transactions}
                        accounts={accounts}
                        isLoading={isLoadingBudget || isLoadingTransactions || isLoadingIncome}
                        onEditBreakdown={handleEditBreakdown}
                        onEditTransaction={handleOpenTransactionForm}
                        onUpdateBudget={updateBudgetItem}
                        onCopyCategory={copyCategoryFromPreviousMonth}
                        onCopyToNextMonth={copyBudgetItemToNextMonth}
                        view={view}
                        groupBy={groupBy}
                        onApplyBudget={handleApplyBudget}
                    />
                </TabsContent>
                <TabsContent value="current">
                     <BudgetTable 
                        budgetItems={monthlyBudgetItems}
                        categories={categories}
                        transactions={transactions}
                        accounts={accounts}
                        isLoading={isLoadingBudget || isLoadingTransactions || isLoadingIncome}
                        onEditBreakdown={handleEditBreakdown}
                        onEditTransaction={handleOpenTransactionForm}
                        onUpdateBudget={updateBudgetItem}
                        onCopyCategory={copyCategoryFromPreviousMonth}
                        onCopyToNextMonth={copyBudgetItemToNextMonth}
                        view={view}
                        groupBy={groupBy}
                        onApplyBudget={handleApplyBudget}
                    />
                </TabsContent>
                <TabsContent value="next">
                     <BudgetTable 
                        budgetItems={monthlyBudgetItems}
                        categories={categories}
                        transactions={transactions}
                        accounts={accounts}
                        isLoading={isLoadingBudget || isLoadingTransactions || isLoadingIncome}
                        onEditBreakdown={handleEditBreakdown}
                        onEditTransaction={handleOpenTransactionForm}
                        onUpdateBudget={updateBudgetItem}
                        onCopyCategory={copyCategoryFromPreviousMonth}
                        onCopyToNextMonth={copyBudgetItemToNextMonth}
                        view={view}
                        groupBy={groupBy}
                        onApplyBudget={handleApplyBudget}
                    />
                </TabsContent>
            </Tabs>
        </main>
      </div>
    </>
  );
}
