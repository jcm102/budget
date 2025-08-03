'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { DebtTable } from '@/components/debt-table';
import { ArrowLeft } from 'lucide-react';

export default function DebtPage() {
  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8">
       <header className="mb-8">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Tasks
          </Link>
        </Button>
      </header>
      <main>
        <DebtTable />
      </main>
    </div>
  );
}
