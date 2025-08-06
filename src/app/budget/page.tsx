
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BudgetTable } from '@/components/budget-table';
import { ArrowLeft, RefreshCw, Trash2 } from 'lucide-react';
import { useBudget } from '@/hooks/use-budget';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
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

export default function BudgetPage() {
  const { syncDebtPayments, clearDebtPayments } = useBudget();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await syncDebtPayments();
      toast({
        title: 'Success!',
        description: 'Your debt payments have been synced to the budget.',
      });
    } catch (error) {
       toast({
        title: 'Error',
        description: 'Failed to sync debt payments.',
        variant: 'destructive',
      });
      console.error('Failed to sync debt payments:', error);
    } finally {
      setIsSyncing(false);
    }
  }

  const handleClear = async () => {
    setIsClearing(true);
    try {
      await clearDebtPayments();
      toast({
        title: 'Success!',
        description: 'Synced debt payments have been cleared from the budget.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to clear debt payments.',
        variant: 'destructive',
      });
      console.error('Failed to clear debt payments:', error);
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-8 flex justify-between items-center">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tasks
          </Link>
        </Button>
        <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={isClearing}>
                  <Trash2 className={`mr-2 h-4 w-4 ${isClearing ? 'animate-spin' : ''}`} />
                   {isClearing ? 'Clearing...' : 'Clear Synced Debts'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all synced debt payments from your budget overview. This will not affect your Debt Worksheet.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClear} className={cn(buttonVariants({ variant: "destructive" }))}>
                    Yes, Clear Debts
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Debts'}
            </Button>
        </div>
      </header>
      <main>
        <BudgetTable />
      </main>
    </div>
  );
}
