
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function MonthlyBudgetPage() {
  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8">
       <header className="mb-8 flex justify-between items-center">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </header>
      <main className="space-y-8">
        <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary">Monthly Budget</h1>
            <p className="text-muted-foreground mt-2 text-lg">
                Set your budget, track your spending, and stay on top of your finances.
            </p>
        </div>

        <div className="flex justify-center p-16 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">Budgeting components will be built here soon!</p>
        </div>
      </main>
    </div>
  );
}
