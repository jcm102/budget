
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CreditCardReport } from '@/components/credit-card-report';
import { ArrowLeft } from 'lucide-react';

export default function ReportsPage() {
  return (
    <div className="container mx-auto max-w-4xl p-4 md:p-8">
       <header className="mb-8">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </header>
      <main>
        <CreditCardReport />
      </main>
    </div>
  );
}
