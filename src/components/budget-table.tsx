
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { Pencil, Save, X, ChevronDown, ArrowRightLeft, CornerDownRight } from 'lucide-react';
import { useMonthlyBudget } from '@/hooks/use-monthly-budget';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from './ui/skeleton';
import { Progress } from './ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { Transaction, Category, MonthlyBudgetItem } from '@/types';
import { Separator } from './ui/separator';
import { useAccountDetails } from '@/hooks/use-transferees';

type BudgetTableProps = {
    budgetItems: MonthlyBudgetItem[];
    categories: Category[];
    transactions: Transaction[];
    isLoading: boolean;
    onEditBreakdown: (category: Category) => void;
}

type CategoryWithChildren = Category & { children: CategoryWithChildren[] };

const buildCategoryTree = (categories: Category[]): CategoryWithChildren[] => {
    const tree: CategoryWithChildren[] = [];
    const map: { [key: string]: CategoryWithChildren } = {};

    categories.forEach(cat => {
        map[cat.id] = { ...cat, children: [] };
    });

    categories.forEach(cat => {
        if (cat.parentId && map[cat.parentId]) {
            map[cat.parentId].children.push(map[cat.id]);
        } else {
            tree.push(map[cat.id]);
        }
    });

    return tree;
}

const CategoryRow = ({ 
    category, 
    level, 
    budgetItems, 
    transactionTotals, 
    transactionsByCategory,
    accountMap,
    onEditBreakdown,
    getCategoryTotals,
}: { 
    category: CategoryWithChildren, 
    level: number,
    budgetItems: MonthlyBudgetItem[],
    transactionTotals: Record<string, number>,
    transactionsByCategory: Record<string, Transaction[]>,
    accountMap: Record<string, string>,
    onEditBreakdown: (category: Category) => void,
    getCategoryTotals: (cat: CategoryWithChildren) => { budgeted: number, actual: number },
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const { budgeted, actual } = getCategoryTotals(category);
    
    const budgetItem = budgetItems.find(b => b.categoryId === category.id);
    const remaining = budgeted - actual;
    const progress = budgeted > 0 ? (actual / budgeted) * 100 : 0;
    const categoryTransactions = transactionsByCategory[category.id] || [];
    
    const hasBreakdown = budgetItem?.breakdown && budgetItem.breakdown.length > 0 && (budgetItem.breakdown.length > 1 || budgetItem.breakdown[0].name !== 'Default');
    const hasChildren = category.children.length > 0;
    const hasTransactions = categoryTransactions.length > 0;
    const isCollapsible = hasTransactions || hasBreakdown || hasChildren;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };
    
    const breakdownTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        if (budgetItem?.breakdown) {
            budgetItem.breakdown.forEach(item => {
                totals[item.name] = 0;
            });
        }
        categoryTransactions.forEach(tx => {
            // Simplified: for now, assume a transaction can be linked to a breakdown item by description.
            // A more robust solution would involve storing breakdown item ID in the transaction.
            const split = tx.splits?.find(s => s.categoryId === category.id);
            if (split) {
                // This logic is flawed as splits are on category, not breakdown.
                // The display logic needs to be based on category totals.
            }
        });
        return totals;
    }, [budgetItem, categoryTransactions, category.id]);


    return (
        <>
            <TableRow className="font-medium" data-state={isOpen ? 'open' : 'closed'}>
                <TableCell style={{ paddingLeft: `${1 + level * 1.5}rem` }}>
                    <div className="flex items-center gap-2">
                        {level > 0 && <CornerDownRight className="h-4 w-4 text-muted-foreground" />}
                        {isCollapsible && 
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsOpen(!isOpen)}>
                                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", isOpen && "-rotate-180")} />
                            </Button>
                        }
                        {!isCollapsible && <div className="w-8 h-8"/>}
                        <span>{category.name}</span>
                    </div>
                </TableCell>
                <TableCell className="text-right">{formatCurrency(budgeted)}</TableCell>
                <TableCell className="text-right">{formatCurrency(actual)}</TableCell>
                <TableCell className="text-right">
                <div className="flex flex-col items-end">
                    <span className={remaining < 0 ? 'text-destructive' : ''}>
                    {formatCurrency(remaining)}
                    </span>
                    <Progress value={progress} className="h-2 w-24 mt-1" />
                </div>
                </TableCell>
                <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEditBreakdown(category)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                </TableCell>
            </TableRow>
            {isCollapsible &&
            <TableRow>
                <TableCell colSpan={5} className="p-0 border-none">
                    <Collapsible open={isOpen}>
                        <CollapsibleContent>
                            <div className="p-4 pl-14 space-y-4 bg-secondary/20">
                                {hasBreakdown && (
                                    <div className="p-3 border rounded-md bg-background/50">
                                        <h4 className="text-sm font-semibold mb-2">Budget Breakdown</h4>
                                        <div className="space-y-1">
                                            {budgetItem?.breakdown?.map((item, idx) => (
                                                <div key={idx} className="flex justify-between text-sm">
                                                    <span>{item.name}</span>
                                                    <span>{formatCurrency(item.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {hasTransactions && (
                                    <div>
                                        {hasBreakdown && <Separator className="my-4"/>}
                                        <h4 className="text-sm font-semibold mb-2">Transactions</h4>
                                        <Table>
                                            <TableBody>
                                            {categoryTransactions.map(tx => (
                                                <TableRow key={tx.id} className="border-b-0 hover:bg-transparent">
                                                    <TableCell className="py-2">{format(new Date(tx.date), 'MMM dd')}</TableCell>
                                                    <TableCell className="py-2">{tx.description}</TableCell>
                                                    {tx.type === 'transfer' && tx.transferFromId && tx.transferToId && (
                                                    <TableCell className="py-2 text-muted-foreground flex items-center gap-1">
                                                        {accountMap[tx.transferFromId] || 'Unknown'} 
                                                        <ArrowRightLeft className="h-3 w-3"/>
                                                        {accountMap[tx.transferToId] || 'Unknown'}
                                                    </TableCell>
                                                    )}
                                                     <TableCell className="py-2 text-right">{formatCurrency(tx.splits?.find(s => s.categoryId === category.id)?.amount || tx.amount)}</TableCell>
                                                </TableRow>
                                            ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                             {hasChildren && (
                                <Table>
                                    <TableBody>
                                    {category.children.map(child => (
                                        <CategoryRow 
                                            key={child.id}
                                            category={child}
                                            level={level + 1}
                                            budgetItems={budgetItems}
                                            transactionTotals={transactionTotals}
                                            transactionsByCategory={transactionsByCategory}
                                            accountMap={accountMap}
                                            onEditBreakdown={onEditBreakdown}
                                            getCategoryTotals={getCategoryTotals}
                                        />
                                    ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CollapsibleContent>
                    </Collapsible>
                </TableCell>
            </TableRow>
           }
        </>
    )
}


export function BudgetTable({ budgetItems, categories, transactions, isLoading, onEditBreakdown }: BudgetTableProps) {
  const { accounts: allAccounts } = useAccountDetails();

  const accountMap = useMemo(() => {
    return allAccounts.reduce((map, acc) => {
        map[acc.id] = acc.name;
        return map;
    }, {} as Record<string, string>);
  }, [allAccounts]);


  const { expenseTransactions, transactionsByCategory } = useMemo(() => {
    const byCategory: Record<string, Transaction[]> = {};
    const expenses: Transaction[] = [];

    transactions.forEach((transaction) => {
      if (transaction.type === 'expense' && transaction.splits) {
        expenses.push(transaction);
        transaction.splits.forEach(split => {
            if (!byCategory[split.categoryId]) {
                byCategory[split.categoryId] = [];
            }
            // Create a pseudo-transaction for each split to display it
            byCategory[split.categoryId].push({
                ...transaction,
                id: `${transaction.id}-${split.categoryId}`,
                amount: split.amount // The amount for this split
            });
        });
      }
    });
    return { expenseTransactions: expenses, transactionsByCategory: byCategory };
  }, [transactions]);
  
  const transactionTotals = useMemo(() => {
     const totals: Record<string, number> = {};
     expenseTransactions.forEach(tx => {
         if (tx.splits) {
            tx.splits.forEach(split => {
                totals[split.categoryId] = (totals[split.categoryId] || 0) + split.amount;
            });
         }
     });
     return totals;
  }, [expenseTransactions]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const renderLoadingSkeleton = () => (
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={`skeleton-budget-${i}`}>
        <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
      </TableRow>
    ))
  );

  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  const getCategoryTotals = useCallback((category: CategoryWithChildren): { budgeted: number, actual: number } => {
    const budgetItem = budgetItems.find(b => b.categoryId === category.id);
    let totals = {
      budgeted: budgetItem?.budgeted || 0,
      actual: transactionTotals[category.id] || 0,
    };

    if (category.children.length > 0) {
      category.children.forEach(child => {
        const childTotals = getCategoryTotals(child);
        // A parent's budget is the sum of its children's budgets *if* it doesn't have one itself.
        // Let's assume parent categories have their own budget fields for now, or are sums.
        // For display, we sum them up.
        totals.budgeted += childTotals.budgeted;
        totals.actual += childTotals.actual;
      });
    }

    return totals;
  }, [budgetItems, transactionTotals]);

  const { totalBudgeted, totalSpent } = useMemo(() => {
    let budgeted = 0;
    let spent = 0;
    categoryTree.forEach(category => {
      const totals = getCategoryTotals(category);
      budgeted += totals.budgeted;
      spent += totals.actual;
    });
    return { totalBudgeted: budgeted, totalSpent: spent };
  }, [categoryTree, getCategoryTotals]);

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Budgeted</TableHead>
            <TableHead className="text-right">Actual</TableHead>
            <TableHead className="text-right">Remaining</TableHead>
            <TableHead className="w-[100px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            renderLoadingSkeleton()
          ) : categoryTree.length > 0 ? (
            categoryTree.map((category) => (
                <CategoryRow 
                    key={category.id} 
                    category={category} 
                    level={0} 
                    budgetItems={budgetItems} 
                    transactionTotals={transactionTotals}
                    transactionsByCategory={transactionsByCategory}
                    accountMap={accountMap}
                    onEditBreakdown={onEditBreakdown}
                    getCategoryTotals={getCategoryTotals}
                />
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center">
                No budget categories created yet. Go to Settings to add some.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-semibold">Totals</TableCell>
            <TableCell className="text-right font-semibold">{formatCurrency(totalBudgeted)}</TableCell>
            <TableCell className="text-right font-semibold">{formatCurrency(totalSpent)}</TableCell>
            <TableCell className="text-right font-semibold">{formatCurrency(totalBudgeted - totalSpent)}</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
