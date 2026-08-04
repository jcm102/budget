'use client';

import React, { useMemo, useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Edit2, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BudgetTableProps {
  budgetItems: any[];
  categories: any[];
  transactions: any[];
  accounts: any[];
  isLoading: boolean;
  onEditBreakdown: (category: any) => void;
  onEditTransaction: (transaction: any) => void;
  onUpdateBudget: (categoryId: string, amount: number) => void;
  onCopyCategory: (categoryId: string) => void;
  onCopyToNextMonth: (item: any) => void;
  view: 'current' | 'next' | 'previous';
  groupBy: 'category' | 'source';
  onApplyBudget: (categoryId: string, categoryName: string, amount: number) => void;
}

export function BudgetTable({
  budgetItems,
  categories,
  transactions,
  accounts,
  isLoading,
  onEditBreakdown,
  groupBy
}: BudgetTableProps) {

  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  // Map data and calculate totals per category
  const tableData = useMemo(() => {
    const rawMapped = categories.map(category => {
      // Find the parent category if this category has a parentId
      const parentCat = category.parentId 
        ? categories.find(c => c.id === category.parentId)
        : null;

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

      // Inherit paymentMethod from parent category if not set
      const resolvedPaymentMethod = category.paymentMethod || parentCat?.paymentMethod || 'none';

      return {
        ...category,
        name: category.name, // Keep base name clean
        parentName: parentCat ? parentCat.name : null,
        paymentMethod: resolvedPaymentMethod,
        budgeted,
        actualSpent,
        remaining,
        progress: Math.min(progress, 100),
        rawItem: budgetItem // keep reference for editing
      };
    });

    // Recursive helper to get total budgeted for a category and all its descendants
    const getRecursiveBudgeted = (catId: string): number => {
      const direct = rawMapped.find(c => c.id === catId)?.budgeted || 0;
      const children = rawMapped.filter(c => c.parentId === catId);
      return direct + children.reduce((sum, child) => sum + getRecursiveBudgeted(child.id), 0);
    };

    const getRecursiveActual = (catId: string): number => {
      const direct = rawMapped.find(c => c.id === catId)?.actualSpent || 0;
      const children = rawMapped.filter(c => c.parentId === catId);
      return direct + children.reduce((sum, child) => sum + getRecursiveActual(child.id), 0);
    };

    // Roll up children totals to parent categories, and flag parents
    return rawMapped.map(category => {
      const children = rawMapped.filter(c => c.parentId === category.id);
      const hasChildren = children.length > 0;

      if (hasChildren) {
        const budgeted = children.reduce((sum, child) => sum + getRecursiveBudgeted(child.id), 0);
        const actualSpent = children.reduce((sum, child) => sum + getRecursiveActual(child.id), 0);
        const remaining = budgeted - actualSpent;
        const progress = budgeted > 0 ? (actualSpent / budgeted) * 100 : 0;

        return {
          ...category,
          budgeted,
          actualSpent,
          remaining,
          progress: Math.min(progress, 100),
          hasChildren: true
        };
      }

      return {
        ...category,
        hasChildren: false
      };
    });
  }, [categories, budgetItems, transactions]);

  // Group table data: by parent category if groupBy === 'category', or by payment source if groupBy === 'source'
  const groupedData = useMemo(() => {
    const groups: { [key: string]: any[] } = {};

    if (groupBy === 'source') {
      const primaryAccounts = ['libro chequing', 'wealthsimple mastercard', 'eq bank mastercard', 'eq card', 'eq mastercard'];
      
      // Initialize groups for all accounts
      accounts.forEach(acc => {
        groups[acc.name] = [];
      });
      groups['Other'] = [];

      const flattenedRows: any[] = [];

      tableData.forEach(row => {
        if (row.hasChildren) return; // Exclude parent categories from source view
        
        const hasBreakdown = row.rawItem?.breakdown && row.rawItem.breakdown.length > 0;
        if (hasBreakdown) {
          row.rawItem.breakdown.forEach((sub: any) => {
            const subActualSpent = transactions
              .filter(tx => tx.splits?.some((split: any) => split.categoryId === row.id && split.budgetItemName === sub.name))
              .reduce((sum, tx) => {
                const splitAmount = tx.splits
                  .filter((split: any) => split.categoryId === row.id && split.budgetItemName === sub.name)
                  .reduce((s: number, split: any) => s + split.amount, 0);
                return sum + splitAmount;
              }, 0);

            const subBudgeted = sub.amount || 0;
            const subRemaining = subBudgeted - subActualSpent;
            const subProgress = subBudgeted > 0 ? (subActualSpent / subBudgeted) * 100 : 0;
            const subPm = sub.paymentMethod || row.paymentMethod || 'Other';

            flattenedRows.push({
              id: `${row.id}-${sub.name}`,
              name: sub.name,
              categoryName: row.name,
              parentName: row.parentName,
              budgeted: subBudgeted,
              actualSpent: subActualSpent,
              remaining: subRemaining,
              progress: Math.min(subProgress, 100),
              paymentMethod: subPm,
              rawItem: row.rawItem,
              isSubItem: true,
              parentCategory: row
            });
          });
        } else {
          flattenedRows.push({
            ...row,
            isSubItem: false
          });
        }
      });

      flattenedRows.forEach(row => {
        const rawPm = row.paymentMethod;
        const pmClean = (!rawPm || rawPm === 'undefined' || rawPm === 'none') ? null : rawPm;
        const matchingAccount = pmClean 
          ? accounts.find(acc => acc.name.toLowerCase() === pmClean.toLowerCase())
          : null;

        if (matchingAccount) {
          groups[matchingAccount.name].push(row);
        } else {
          groups['Other'].push(row);
        }
      });

      // Filter groups: always show primary accounts, show others only if they contain items
      return Object.keys(groups).sort((a, b) => {
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
      })
      .map(key => ({
        name: key,
        type: 'source',
        parentRow: null,
        rows: groups[key]
      }))
      .filter(group => {
        if (group.name === 'Other') {
          return group.rows.length > 0;
        }
        const isPrimary = primaryAccounts.includes(group.name.toLowerCase());
        const hasCategories = group.rows.length > 0;
        return isPrimary || hasCategories;
      });

    } else {
      // groupBy === 'category': Group by Parent Category
      // Helper to walk up the category parent tree to find the root parent category
      const getRootParent = (cat: any) => {
        let current = cat;
        while (current.parentId && current.parentId !== 'null' && current.parentId !== 'undefined') {
          const parent = tableData.find(c => c.id === current.parentId);
          if (!parent) break;
          current = parent;
        }
        return current;
      };

      // 1. Identify all parent categories (categories that have no parent)
      const parents = tableData.filter(c => !c.parentId || c.parentId === 'null' || c.parentId === 'undefined');

      parents.forEach(p => {
        groups[p.name] = [];
      });

      // 2. Put subcategories under their root parents
      tableData.forEach(row => {
        const isRoot = !row.parentId || row.parentId === 'null' || row.parentId === 'undefined';
        if (isRoot) return; // Root parents are headers, they don't list as rows
        if (row.hasChildren) return; // Middle-tier parents are also headers/non-editable, they don't list as rows

        const rootParent = getRootParent(row);
        if (rootParent) {
          groups[rootParent.name] = groups[rootParent.name] || [];
          groups[rootParent.name].push(row);
        } else {
          groups['Other'] = groups['Other'] || [];
          groups['Other'].push(row);
        }
      });

      // Sort category groups: alphabetical
      return Object.keys(groups)
        .sort((a, b) => a.localeCompare(b))
        .map(key => {
          const parentRow = tableData.find(c => c.name === key);
          return {
            name: key,
            type: 'category',
            parentRow: parentRow || null,
            rows: groups[key]
          };
        })
        .filter(group => group.rows.length > 0 || (group.parentRow && group.parentRow.hasChildren));
    }
  }, [tableData, accounts, groupBy, transactions]);

  const getAccountBalance = (accountName: string) => {
    const account = accounts.find(acc => acc.name.toLowerCase() === accountName.toLowerCase());
    if (!account) return null;
    return account.balance ?? 0;
  };

  const handleEditClick = (row: any) => {
    if (row.isSubItem) {
      onEditBreakdown(row.parentCategory);
    } else {
      onEditBreakdown(row);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading budget data...</div>;
  }

  // Helper function to render category rows and their breakdown sub-items
  const renderCategoryRow = (row: any, indentClass: string, allRows: any[], parentGroupName: string) => {
    const hasBreakdown = row.rawItem?.breakdown && row.rawItem.breakdown.length > 0;
    const isBreakdownExpanded = !!expandedRows[`breakdown-${row.id}`];

    const handleToggleBreakdown = (e: React.MouseEvent) => {
      e.stopPropagation();
      setExpandedRows(prev => ({ ...prev, [`breakdown-${row.id}`]: !prev[`breakdown-${row.id}`] }));
    };

    const displayName = row.parentName && row.parentName !== parentGroupName
      ? `${row.parentName} > ${row.name}`
      : row.name;

    return (
      <React.Fragment key={row.id}>
        <TableRow className="hover:bg-muted/30">
          <TableCell className={cn("font-medium", indentClass)}>
            <div className="flex items-center gap-1.5">
              {hasBreakdown ? (
                <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-muted" onClick={handleToggleBreakdown}>
                  {isBreakdownExpanded ? <ChevronDown className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                </Button>
              ) : (
                <span className="w-6" /> // Spacer to align text correctly
              )}
              <span>{displayName}</span>
            </div>
          </TableCell>
          <TableCell>
             <div className="flex items-center gap-2">
               {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.budgeted)}
               {!row.hasChildren && (
                 <Button 
                   variant="ghost" 
                   size="icon" 
                   className="h-6 w-6 hover:bg-muted" 
                   onClick={() => handleEditClick(row)}
                 >
                   <Edit2 className="h-3 w-3" />
                 </Button>
               )}
             </div>
          </TableCell>
          <TableCell>
             {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.actualSpent)}
          </TableCell>
          <TableCell className={cn("font-medium", row.remaining < 0 ? "text-destructive" : "text-green-600")}>
             {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.remaining)}
          </TableCell>
        </TableRow>

        {/* Render breakdown sub-items if expanded */}
        {hasBreakdown && isBreakdownExpanded && row.rawItem.breakdown.map((sub: any) => {
          // Calculate actual spent for sub-item
          const subActualSpent = transactions
            .filter(tx => tx.splits?.some((split: any) => split.categoryId === row.id && split.budgetItemName === sub.name))
            .reduce((sum, tx) => {
              const splitAmount = tx.splits
                .filter((split: any) => split.categoryId === row.id && split.budgetItemName === sub.name)
                .reduce((s: number, split: any) => s + split.amount, 0);
              return sum + splitAmount;
            }, 0);

          const subBudgeted = sub.amount || 0;
          const subRemaining = subBudgeted - subActualSpent;

          return (
            <TableRow key={`${row.id}-sub-${sub.name}`} className="bg-muted/10 border-l-4 border-primary/20 hover:bg-muted/20">
              <TableCell className="pl-14 text-xs font-normal text-muted-foreground">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span>{sub.name}</span>
                    {sub.paymentMethod && sub.paymentMethod !== row.paymentMethod && (
                      <span className="text-[9px] text-primary/75 italic font-medium">({sub.paymentMethod})</span>
                    )}
                    {sub.notes && (
                      <span className="text-[10px] text-muted-foreground/75 italic font-light">— {sub.notes}</span>
                    )}
                  </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subBudgeted)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subActualSpent)}
              </TableCell>
              <TableCell className={cn("text-xs", subRemaining < 0 ? "text-destructive" : "text-green-600/85")}>
                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(subRemaining)}
              </TableCell>
            </TableRow>
          );
        })}
      </React.Fragment>
    );
  };

  const showHeaders = Object.keys(expandedRows).some(key => key.startsWith('parent-') && expandedRows[key] === true);

  return (
    <div className="rounded-md border bg-card font-sans">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">{groupBy === 'source' ? 'Payment Source' : 'Category'}</TableHead>
            <TableHead>{showHeaders ? 'Budgeted' : ''}</TableHead>
            <TableHead>{showHeaders ? 'Actual' : ''}</TableHead>
            <TableHead>{showHeaders ? 'Remaining' : ''}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center">
                No categories found.
              </TableCell>
            </TableRow>
          ) : (
            groupedData.map((group) => {
              const balance = getAccountBalance(group.name);
              const isGroupExpanded = !!expandedRows[`parent-${group.name}`];

              return (
                <React.Fragment key={group.name}>
                  {/* Group Divider / Header */}
                  <TableRow className="bg-muted/50 hover:bg-muted/50 border-y border-muted">
                    <TableCell colSpan={4} className="py-2.5 px-4 font-bold text-sm text-primary">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 p-0 hover:bg-muted"
                            onClick={() => setExpandedRows(prev => ({ ...prev, [`parent-${group.name}`]: !prev[`parent-${group.name}`] }))}
                          >
                            {isGroupExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                          <span>{group.name}</span>
                        </div>
                         {group.type === 'source' && (() => {
                           const totalBudgeted = group.rows.reduce((sum, r) => sum + r.budgeted, 0);
                           const totalActual = group.rows.reduce((sum, r) => sum + r.actualSpent, 0);
                           const available = balance !== null ? balance - (totalBudgeted - totalActual) : 0;
                           return (
                             <div className={cn(
                               "text-[11px] font-semibold text-muted-foreground bg-background px-3 py-1.5 border rounded-md no-print",
                               balance !== null ? "grid grid-cols-3 gap-2.5 w-[445px]" : "flex justify-between w-[445px]"
                             )}>
                               {balance !== null ? (
                                 <>
                                   <div className="flex justify-between items-center gap-1">
                                     <span className="text-muted-foreground/80">Balance:</span>
                                     <strong className={cn("font-bold text-primary whitespace-nowrap", balance < 0 && group.name.toLowerCase().includes('mastercard') ? "text-destructive" : "")}>
                                       {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(balance)}
                                     </strong>
                                   </div>
                                   <div className="flex justify-between items-center gap-1 border-l pl-2.5">
                                     <span className="text-muted-foreground/80">Assigned:</span>
                                     <strong className="text-primary font-bold whitespace-nowrap">
                                       {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalBudgeted)}
                                     </strong>
                                   </div>
                                   <div className="flex justify-between items-center gap-1 border-l pl-2.5">
                                     <span className="text-muted-foreground/80">Available:</span>
                                     <strong className={cn("font-bold whitespace-nowrap", available < 0 ? "text-destructive" : "text-green-600")}>
                                       {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(available)}
                                     </strong>
                                   </div>
                                 </>
                               ) : (
                                 <div className="flex justify-between items-center gap-1 w-full">
                                   <span className="text-muted-foreground/80">Assigned:</span>
                                   <strong className="text-primary font-bold whitespace-nowrap">
                                     {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalBudgeted)}
                                   </strong>
                                 </div>
                               )}
                             </div>
                           );
                         })()}
                        {group.type === 'category' && group.parentRow && (
                          <div className="grid grid-cols-3 gap-2.5 text-[11px] font-semibold text-muted-foreground bg-background px-3 py-1.5 border rounded-md w-[445px] no-print">
                            <div className="flex justify-between items-center gap-1">
                              <span className="text-muted-foreground/80">Budgeted:</span>
                              <span className="text-primary font-bold whitespace-nowrap">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(group.parentRow.budgeted)}</span>
                            </div>
                            <div className="flex justify-between items-center gap-1 border-l pl-2.5">
                              <span className="text-muted-foreground/80">Actual:</span>
                              <span className="text-primary font-bold whitespace-nowrap">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(group.parentRow.actualSpent)}</span>
                            </div>
                            <div className="flex justify-between items-center gap-1 border-l pl-2.5">
                              <span className="text-muted-foreground/80">Remaining:</span>
                              <span className={cn("font-bold whitespace-nowrap", group.parentRow.remaining < 0 ? "text-destructive" : "text-green-600")}>
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(group.parentRow.remaining)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  {/* Category Rows inside Group */}
                  {isGroupExpanded && (
                    group.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="h-10 text-center text-xs text-muted-foreground italic pl-6">
                          No categories assigned to this group.
                        </TableCell>
                      </TableRow>
                    ) : (
                      group.rows.map((row) => {
                        if (groupBy === 'category') {
                          return renderCategoryRow(row, "pl-6", group.rows, group.name);
                        }
                        return (
                          <TableRow key={row.id}>
                            <TableCell className="font-medium pl-6">
                              <div className="flex flex-col gap-1">
                                <span>{row.name}</span>
                                {row.isSubItem && (
                                  <span className="text-[10px] text-muted-foreground italic font-normal">
                                    ({row.categoryName})
                                  </span>
                                )}
                                {row.parentName && (
                                  <span className="text-[9px] text-primary/75 italic font-medium">
                                    {row.parentName}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                               <div className="flex items-center gap-2">
                                 {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.budgeted)}
                                 <Button 
                                   variant="ghost" 
                                   size="icon" 
                                   className="h-6 w-6" 
                                   onClick={() => handleEditClick(row)}
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
                          </TableRow>
                        );
                      })
                    )
                  )}
                </React.Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}