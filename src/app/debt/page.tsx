'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DebtTable } from '@/components/debt-table';
import { ArrowLeft, Printer } from 'lucide-react';

export default function DebtPage() {
  const handlePrint = () => {
    window.print();
  }
  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8">
       <header className="mb-8 flex justify-between items-center no-print">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tasks
          </Link>
        </Button>
         <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
      </header>
      <main>
        <DebtTable />
      </main>
    </div>
  );
}
