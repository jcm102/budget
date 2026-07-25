'use client';

import { useMemo } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit2, Plus, Copy, ArrowRight } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/utils'; // Ensure this helper exists or use local formatter

interface BudgetTableProps {
  budgetItems: any[];
  categories: any[];
  transactions: any[];
  isLoading: boolean;
  onEditBreakdown: (category: any) => void;
  onEditTransaction: (transaction: any) => void;
  onUpdateBudget: (categoryId: string, amount: number) => void;
  onCopyCategory: (categoryId: string) => void;
  onCopyToNextMonth: (item: any) => void;
  view: 'current' | 'next' | 'previous';
  onApplyBudget: (categoryId: string, categoryName: string, amount: number) => void;
}

export function BudgetTable({
  budgetItems,
  categories,
  transactions,
  isLoading,
  onEditBreakdown,
  onUpdateBudget,
  view
}: BudgetTableProps) {

  // Map data and calculate totals per category
  const tableData = useMemo(() => {
    return categories.map(category => {
      // Find the budget item for this category
      const budgetItem = budgetItems.find(item => 
        item.categoryId === category.id || item.category === category.name
      );

      // Safe Mapping for amount/budgeted
      const budgeted = budgetItem?.budgeted ?? budgetItem?.amount ?? 0;
      
      // Calculate actual spent from transactions for this category
      const actualSpent = transactions
        .filter(tx => tx.splits?.some((split: any) => split.categoryId === category.id))
        .reduce((sum, tx) => {
          const splitAmount = tx.splits
            .filter((split: any) => split.categoryId === category.id)
            .reduce((s: number, split: any) => s + split.amount, 0);
          return sum + splitAmount;
        }, 0);

      const remaining = budgeted - actualSpent;
      const progress = budgeted > 0 ? (actualSpent / budgeted) * 100 : 0;

      return {
        ...category,
        budgeted,
        actualSpent,
        remaining,
        progress: Math.min(progress, 100),
        rawItem: budgetItem // keep reference for editing
      };
    });
  }, [categories, budgetItems, transactions]);

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading budget data...</div>;
  }

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Category</TableHead>
            <TableHead>Budgeted</TableHead>
            <TableHead>Actual</TableHead>
            <TableHead>Remaining</TableHead>
            <TableHead className="w-[200px]">Progress</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tableData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                No categories found.
              </TableCell>
            </TableRow>
          ) : (
            tableData.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">
                  {row.name}
                </TableCell>
                <TableCell>
                   <div className="flex items-center gap-2">
                     {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.budgeted)}
                     <Button 
                       variant="ghost" 
                       size="icon" 
                       className="h-6 w-6" 
                       onClick={() => onEditBreakdown(row)}
                     >
                       <Edit2 className="h-3 w-3" />
                     </Button>
                   </div>
                </TableCell>
                <TableCell>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.actualSpent)}
                </TableCell>
                <TableCell className={row.remaining < 0 ? "text-destructive font-medium" : "text-green-600 font-medium"}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.remaining)}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <Progress value={row.progress} className="h-2" />
                    <p className="text-[10px] text-muted-foreground text-right">{Math.round(row.progress)}%</p>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                   <Button variant="ghost" size="sm" onClick={() => onEditBreakdown(row)}>
                     Adjust
                   </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}