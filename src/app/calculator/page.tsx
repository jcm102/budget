
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Calculator } from '@/components/calculator';
import { ArrowLeft } from 'lucide-react';

export default function CalculatorPage() {
  return (
    <div className="container mx-auto max-w-sm p-4 md:p-8 flex flex-col h-full">
       <header className="mb-8 flex-shrink-0">
        <Button asChild variant="outline">
          <Link href="/tasks">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </header>
      <main className="flex-grow">
        <Calculator />
      </main>
    </div>
  );
}
