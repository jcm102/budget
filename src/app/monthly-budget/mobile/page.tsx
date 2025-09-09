
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
  const { addTransaction, accounts, updateTransaction, deleteTransaction } = useTransactions();

  return (
    <>
      <TransactionForm
        open={isTransactionFormOpen}
        onOpenChange={setIsTransactionFormOpen}
        accounts={accounts}
        addTransaction={addTransaction}
        updateTransaction={updateTransaction}
        deleteTransaction={deleteTransaction}
        editingTransaction={null}
      />
      <div className="container mx-auto max-w-md p-4 flex flex-col min-h-screen">
        <header className="mb-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/monthly-budget">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Full Budget
            </Link>
          </Button>
        </header>
        <main className="flex-1 flex flex-col gap-4">
             <div className="py-2">
                <Button size="lg" className="w-full h-14 text-lg" onClick={() => setIsTransactionFormOpen(true)}>
                    <PlusCircle className="mr-2 h-6 w-6" />
                    Add Transaction
                </Button>
            </div>
            <div className="flex-grow">
                <Calculator />
            </div>
        </main>
      </div>
    </>
  );
}
