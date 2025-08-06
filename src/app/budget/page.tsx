
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BudgetTable } from '@/components/budget-table';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useBudget } from '@/hooks/use-budget';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export default function BudgetPage() {
  const { syncDebtPayments } = useBudget();
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

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

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-8 flex justify-between items-center">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tasks
          </Link>
        </Button>
         <Button variant="outline" onClick={handleSync} disabled={isSyncing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Syncing...' : 'Sync Debts'}
          </Button>
      </header>
      <main>
        <BudgetTable />
      </main>
    </div>
  );
}
