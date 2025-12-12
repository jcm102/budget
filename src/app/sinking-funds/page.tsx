
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { SinkingFundTable } from '../savings/components/sinking-fund-table';

export default function SinkingFundsPage() {
  return (
    <div className="container mx-auto max-w-4xl p-4 md:p-8">
       <header className="mb-8">
        <Button asChild variant="outline">
          <Link href="/savings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Savings
          </Link>
        </Button>
      </header>
      <main>
        <h1 className="text-3xl font-bold font-headline text-primary mb-6">Sinking Funds</h1>
        <SinkingFundTable />
      </main>
    </div>
  );
}
