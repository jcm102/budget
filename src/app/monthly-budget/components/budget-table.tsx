
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { format } from 'date-fns';
import { Pencil, Save, X, ChevronDown, ArrowRightLeft, CornerDownRight, Copy } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { Transaction, Category, MonthlyBudgetItem, BudgetSubItem } from '@/types';
import { Separator } from '@/components/ui/separator';
import { useAccountDetails } from '@/hooks/use-account-details';
import { useToast } from '@/hooks/use-toast';
import { useMonthlyBudget } from '../hooks/use-monthly-budget';

type BudgetTableProps = {
    budgetItems: MonthlyBudgetItem[];
    categories: Category[];
    transactions: Transaction[];
    isLoading: boolean;
    onEditBreakdown: (category: Category) => void;
    onEditTransaction: (transaction: Transaction) => void;
    onUpdateBudget: (categoryId: string, budgeted: number) => void;
    onCopyCategory: (categoryId: string) => void;
    onCopyToNextMonth: (budgetItem: MonthlyBudgetItem) => void;
    view: 'current' | 'next';
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
    transactions,
    accountMap,
    onEditBreakdown,
    getCategoryTotals,
    onEditTransaction,
    onUpdateBudget,
    onCopyCategory,
    onCopyToNextMonth,
    view,
}: { 
    category: CategoryWithChildren, 
    level: number,
    budgetItems: MonthlyBudgetItem[],
    transactions: Transaction[],
    accountMap: Record<string, string>,
    onEditBreakdown: (category: Category) => void,
    getCategoryTotals: (cat: CategoryWithChildren) => { budgeted: number, actual: number, breakdown: Record<string, { budgeted: number, actual: number }> },
    onEditTransaction: (transaction: Transaction) => void,
    onUpdateBudget: (categoryId: string, budgeted: number) => void;
    onCopyCategory: (categoryId: string) => void;
    onCopyToNextMonth: (budgetItem: MonthlyBudgetItem) => void;
    view: 'current' | 'next';
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [budgetInput, setBudgetInput] = useState<number | string>('');


    const { budgeted, actual, breakdown: breakdownTotals } = getCategoryTotals(category);
    
    const remaining = budgeted - actual;
    const progress = budgeted > 0 ? (actual / budgeted) * 100 : 0;
    
    const budgetItem = budgetItems.find(b => b.categoryId === category.id);
    const hasBreakdown = budgetItem && budgetItem.breakdown && budgetItem.breakdown.length > 0 && !(budgetItem.breakdown.length === 1 && budgetItem.breakdown[0].name === 'Default');
    const hasChildren = category.children.length > 0;
    
    const relevantTransactions = useMemo(() => {
        return transactions.filter(tx => 
            tx.splits?.some(s => s.categoryId === category.id)
        );
    }, [transactions, category.id]);
    
    const hasTransactions = relevantTransactions.length > 0;
    const isCollapsible = hasTransactions || hasBreakdown || hasChildren;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    const handleEditClick = () => {
        setBudgetInput(budgeted);
        setIsEditing(true);
    };

    const handleSave = () => {
        const newBudgeted = Number(budgetInput);
        if (!isNaN(newBudgeted)) {
            onUpdateBudget(category.id, newBudgeted);
        }
        setIsEditing(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
    };
    
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
                <TableCell className="text-right">
                   {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                            <Input
                                type="number"
                                value={budgetInput}
                                onChange={(e) => setBudgetInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                className="h-8 w-24 text-right"
                                autoFocus
                            />
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={handleSave}><Save className="h-4 w-4"/></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCancel}><X className="h-4 w-4"/></Button>
                        </div>
                    ) : (
                        <div className="group flex items-center justify-end gap-1">
                            <span>{formatCurrency(budgeted)}</span>
                            <div className="opacity-0 group-hover:opacity-100 flex">
                                {view === 'next' && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onCopyCategory(category.id)}>
                                        <Copy className="h-4 w-4 text-blue-500" />
                                    </Button>
                                )}
                                {view === 'current' && budgetItem && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onCopyToNextMonth(budgetItem)}>
                                        <Copy className="h-4 w-4 text-blue-500" />
                                    </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleEditClick}><Pencil className="h-4 w-4"/></Button>
                            </div>
                        </div>
                    )}
                </TableCell>
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
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead>Item</TableHead>
                                                    <TableHead className="text-right">Budgeted</TableHead>
                                                    <TableHead className="text-right">Actual</TableHead>
                                                    <TableHead className="text-right">Remaining</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                            {Object.entries(breakdownTotals).map(([name, totals]) => {
                                                if (name === "Default") return null;
                                                const itemRemaining = totals.budgeted - totals.actual;
                                                return (
                                                    <TableRow key={name} className="hover:bg-transparent border-b-0">
                                                        <TableCell className="py-1">{name}</TableCell>
                                                        <TableCell className="py-1 text-right">{formatCurrency(totals.budgeted)}</TableCell>
                                                        <TableCell className="py-1 text-right">{formatCurrency(totals.actual)}</TableCell>
                                                        <TableCell className={`py-1 text-right ${itemRemaining < 0 ? 'text-destructive' : ''}`}>{formatCurrency(itemRemaining)}</TableCell>
                                                    </TableRow>
                                                )
                                            })}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                                {hasTransactions && (
                                    <div>
                                        {hasBreakdown && <Separator className="my-4"/>}
                                        <h4 className="text-sm font-semibold mb-2">Transactions</h4>
                                        <Table>
                                            <TableBody>
                                            {relevantTransactions.map(tx => (
                                                <TableRow key={tx.id} className="border-b-0 hover:bg-background/50 cursor-pointer" onClick={() => onEditTransaction(tx)}>
                                                    <TableCell className="py-2">{format(new Date(tx.date), 'MMM dd')}</TableCell>
                                                    <TableCell className="py-2">{tx.description}</TableCell>
                                                     <TableCell className="py-2 text-muted-foreground">
                                                        {accountMap[tx.sourceAccountId] || 'Unknown'}
                                                    </TableCell>
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
                                            transactions={transactions}
                                            accountMap={accountMap}
                                            onEditBreakdown={onEditBreakdown}
                                            getCategoryTotals={getCategoryTotals}
                                            onEditTransaction={onEditTransaction}
                                            onUpdateBudget={onUpdateBudget}
                                            onCopyCategory={onCopyCategory}
                                            onCopyToNextMonth={onCopyToNextMonth}
                                            view={view}
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


export function BudgetTable({ budgetItems, categories, transactions, isLoading, onEditBreakdown, onEditTransaction, onUpdateBudget, onCopyCategory, onCopyToNextMonth, view }: BudgetTableProps) {
  const { accounts: allAccounts } = useAccountDetails();

  const accountMap = useMemo(() => {
    return allAccounts.reduce((map, acc) => {
        map[acc.id] = acc.name;
        return map;
    }, {} as Record<string, string>);
  }, [allAccounts]);


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

 const getCategoryTotals = useCallback((category: CategoryWithChildren): { budgeted: number, actual: number, breakdown: Record<string, { budgeted: number, actual: number }> } => {
    const budgetItem = budgetItems.find(b => b.categoryId === category.id);
    let totals = {
      budgeted: 0,
      actual: 0,
      breakdown: {} as Record<string, { budgeted: number, actual: number }>
    };

    // Initialize breakdown totals from budgetItem
    if (budgetItem?.breakdown && budgetItem.breakdown.length > 0) {
        budgetItem.breakdown.forEach(item => {
            totals.breakdown[item.name] = { budgeted: item.amount, actual: 0 };
        });
    } else if (budgetItem) {
        // Handle categories that have a budget but no explicit breakdown
        totals.breakdown['Default'] = { budgeted: budgetItem.budgeted, actual: 0 };
    }

    // Sum up actuals from transactions
    transactions.forEach(tx => {
        tx.splits?.forEach(split => {
            if (split.categoryId === category.id) {
                const budgetItemName = split.budgetItemName || 'Default';
                // If the specific sub-category doesn't exist in the breakdown, create it.
                if (!totals.breakdown[budgetItemName]) {
                    totals.breakdown[budgetItemName] = { budgeted: 0, actual: 0 };
                }
                totals.breakdown[budgetItemName].actual += split.amount;
            }
        })
    });
    
    totals.budgeted = budgetItem?.budgeted || 0;
    totals.actual = Object.values(totals.breakdown).reduce((sum, item) => sum + item.actual, 0);


    if (category.children.length > 0) {
      category.children.forEach(child => {
        const childTotals = getCategoryTotals(child);
        totals.budgeted += childTotals.budgeted;
        totals.actual += childTotals.actual;
      });
    }

    return totals;
  }, [budgetItems, transactions]);

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
                    transactions={transactions}
                    accountMap={accountMap}
                    onEditBreakdown={onEditBreakdown}
                    getCategoryTotals={getCategoryTotals}
                    onEditTransaction={onEditTransaction}
                    onUpdateBudget={onUpdateBudget}
                    onCopyCategory={onCopyCategory}
                    onCopyToNextMonth={onCopyToNextMonth}
                    view={view}
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
