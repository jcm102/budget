
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import { Calculator } from '@/components/calculator';
import { TransactionForm } from '@/components/transaction-form';
import { useTransactions } from '@/hooks/use-transactions';

export default function MobileBudgetPage() {
  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const { addTransaction } = useTransactions();

  return (
    <>
      <TransactionForm
        open={isTransactionFormOpen}
        onOpenChange={setIsTransactionFormOpen}
        addTransaction={addTransaction}
      />
      <div className="container mx-auto max-w-md p-4 flex flex-col h-screen">
        <header className="mb-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/monthly-budget">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Full Budget
            </Link>
          </Button>
        </header>
        <main className="flex-grow flex flex-col gap-4">
            <div className="flex-grow">
                <Calculator />
            </div>
            <div className="py-2">
                <Button size="lg" className="w-full h-14 text-lg" onClick={() => setIsTransactionFormOpen(true)}>
                    <PlusCircle className="mr-2 h-6 w-6" />
                    Add Transaction
                </Button>
            </div>
        </main>
      </div>
    </>
  );
}
