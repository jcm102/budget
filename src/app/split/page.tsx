
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SplitCalculator } from '@/components/split-calculator';
import { ArrowLeft } from 'lucide-react';

export default function SplitPage() {
  return (
    <div className="container mx-auto max-w-2xl p-4 md:p-8">
       <header className="mb-8">
        <Button asChild variant="outline">
          <Link href="/tasks">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </header>
      <main>
        <SplitCalculator />
      </main>
    </div>
  );
}
