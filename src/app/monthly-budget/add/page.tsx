'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { TransactionForm } from '../components/transaction-form';
import { useTransactions } from '../hooks/use-transactions';
import { useAccountDetails } from '@/hooks/use-transferees';

export default function AddTransactionPage() {
  const { addTransaction, updateTransaction, deleteTransaction } = useTransactions();
  const { accounts } = useAccountDetails();

  return (
    <div className="container mx-auto max-w-2xl p-4 md:p-8 h-screen flex flex-col">
       <header className="mb-4">
        <Button asChild variant="outline">
          <Link href="/monthly-budget">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Budget
          </Link>
        </Button>
      </header>
      <TransactionForm
        open={true} // The form is always "open" on this dedicated page
        isPage={true} // New prop to render as a page, not a dialog
        onOpenChange={() => {}} // No-op as it's not a dialog
        accounts={accounts}
        addTransaction={addTransaction}
        updateTransaction={updateTransaction}
        deleteTransaction={deleteTransaction}
        editingTransaction={null}
      />
    </div>
  );
}
