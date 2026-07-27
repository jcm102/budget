'use client';

import { useState, useEffect, useMemo } from 'react';
import { format, parse, subDays, isBefore, isAfter, startOfDay } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Check, X, RotateCcw, AlertCircle } from 'lucide-react';
import type { BudgetItem } from '@/types';

type PendingPaymentsModalProps = {
  budgetItems: BudgetItem[];
  onMarkPaid: (id: string, itemData: Partial<Omit<BudgetItem, 'id' | 'originalId'>>, updateType?: 'instance' | 'pattern') => Promise<void>;
  onSkip: (id: string, deleteType?: 'instance' | 'pattern') => Promise<void>;
  onClose: () => void;
};

export function PendingPaymentsModal({ budgetItems, onMarkPaid, onSkip, onClose }: PendingPaymentsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [processedItemIds, setProcessedItemIds] = useState<Set<string>>(new Set());
  const [postponedItemIds, setPostponedItemIds] = useState<Set<string>>(new Set());

  // Retrieve last checked date on mount
  const lastCheckedDateStr = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('budget_last_checked_date');
  }, []);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  // Filter items that occurred between lastCheckedDate and today (inclusive)
  const pendingItems = useMemo(() => {
    if (!lastCheckedDateStr) return [];
    
    const lastChecked = startOfDay(parse(lastCheckedDateStr, 'yyyy-MM-dd', new Date()));
    const today = startOfDay(new Date());

    return budgetItems.filter(item => {
      // Only check recurring items
      if (item.frequency === 'One-Time') return false;
      if (item.completed) return false;
      
      const itemDate = startOfDay(parse(item.date, 'yyyy-MM-dd', new Date()));
      
      // Date must be between last checked and today (inclusive)
      const isAfterOrEqualLastChecked = itemDate.getTime() >= lastChecked.getTime();
      const isBeforeOrEqualToday = itemDate.getTime() <= today.getTime();

      return isAfterOrEqualLastChecked && isBeforeOrEqualToday;
    });
  }, [budgetItems, lastCheckedDateStr]);

  // Open modal if there are pending items that haven't been processed yet
  useEffect(() => {
    if (lastCheckedDateStr && pendingItems.length > 0) {
      const unprocessed = pendingItems.filter(item => !processedItemIds.has(item.id) && !postponedItemIds.has(item.id));
      if (unprocessed.length > 0) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    } else {
      // If no last checked date exists, initialize it to today so we start tracking from now on
      if (typeof window !== 'undefined' && !localStorage.getItem('budget_last_checked_date')) {
        localStorage.setItem('budget_last_checked_date', todayStr);
      }
      setIsOpen(false);
    }
  }, [pendingItems, processedItemIds, postponedItemIds, lastCheckedDateStr, todayStr]);

  const itemsToShow = useMemo(() => {
    return pendingItems.filter(item => !processedItemIds.has(item.id) && !postponedItemIds.has(item.id));
  }, [pendingItems, processedItemIds, postponedItemIds]);

  const handleMarkPaid = async (item: BudgetItem) => {
    try {
      await onMarkPaid(item.id, { completed: true }, 'instance');
      setProcessedItemIds(prev => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });
    } catch (e) {
      console.error("Failed to mark paid:", e);
    }
  };

  const handleSkip = async (item: BudgetItem) => {
    try {
      await onSkip(item.id, 'instance');
      setProcessedItemIds(prev => {
        const next = new Set(prev);
        next.add(item.id);
        return next;
      });
    } catch (e) {
      console.error("Failed to skip item:", e);
    }
  };

  const handlePostpone = (item: BudgetItem) => {
    setPostponedItemIds(prev => {
      const next = new Set(prev);
      next.add(item.id);
      return next;
    });
  };

  const handleFinishCheck = () => {
    if (typeof window === 'undefined') return;

    // Find the oldest postponed item's date
    const postponedItems = pendingItems.filter(item => postponedItemIds.has(item.id));
    if (postponedItems.length > 0) {
      // Find oldest date
      const oldestDate = postponedItems.reduce((oldest, current) => {
        const oldestD = parse(oldest.date, 'yyyy-MM-dd', new Date());
        const currentD = parse(current.date, 'yyyy-MM-dd', new Date());
        return isBefore(currentD, oldestD) ? current : oldest;
      });
      
      // Set last checked date to the day before the oldest postponed item
      const postponedDate = parse(oldestDate.date, 'yyyy-MM-dd', new Date());
      const dayBefore = subDays(postponedDate, 1);
      localStorage.setItem('budget_last_checked_date', format(dayBefore, 'yyyy-MM-dd'));
    } else {
      // All items resolved (either paid or skipped), set last checked date to today
      localStorage.setItem('budget_last_checked_date', todayStr);
    }
    
    setIsOpen(false);
    onClose();
  };

  if (!isOpen || itemsToShow.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <AlertCircle className="h-6 w-6 text-primary animate-pulse" />
            <DialogTitle className="text-2xl font-bold font-headline">Pending Budget Checklist</DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground mt-1">
            The following recurring items are scheduled since your last visit. Please review and take action:
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto my-4 border rounded-md">
          <Table>
            <TableHeader className="bg-muted/40 sticky top-0 z-10">
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right w-[240px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itemsToShow.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="font-semibold">{item.description}</TableCell>
                  <TableCell>
                    <Badge variant={
                      item.type === 'Income' ? 'default' : 
                      item.type === 'Transfers' ? 'outline' : 'secondary'
                    }>
                      {item.type}
                    </Badge>
                  </TableCell>
                  <TableCell>{format(parse(item.date, 'yyyy-MM-dd', new Date()), 'PP')}</TableCell>
                  <TableCell className="text-right font-medium">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(item.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="default" className="h-8 gap-1" onClick={() => handleMarkPaid(item)}>
                        <Check className="h-3.5 w-3.5" /> Paid
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 gap-1 hover:text-destructive hover:border-destructive/50" onClick={() => handleSkip(item)}>
                        <X className="h-3.5 w-3.5" /> Skip
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 gap-1 text-muted-foreground hover:text-foreground" onClick={() => handlePostpone(item)}>
                        <RotateCcw className="h-3.5 w-3.5" /> Postpone
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="mt-2 flex items-center justify-between sm:justify-between w-full">
          <p className="text-xs text-muted-foreground">
            * Paid adjusts balances; Skip archives the instance; Postpone prompts you again next time.
          </p>
          <Button variant="default" size="lg" className="px-6 font-semibold" onClick={handleFinishCheck}>
            Finish Review ({itemsToShow.length} left)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
