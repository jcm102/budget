
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SavingsTable } from '@/components/savings-table';
import { ArrowLeft, ChevronsUpDown } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AutoShipTable } from '@/components/autoship-table';
import { SubscriptionTable } from '@/components/subscription-table';

export default function SavingsPage() {
  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-8">
       <header className="mb-8">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </header>
      <main className="space-y-8">
        <Collapsible defaultOpen={true}>
            <CollapsibleTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 pl-0 hover:bg-transparent text-3xl font-bold font-headline text-primary mb-4">
                    <ChevronsUpDown className="h-6 w-6 text-muted-foreground" />
                    <h2>Future Spending Savings</h2>
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <SavingsTable />
            </CollapsibleContent>
        </Collapsible>
        
        <Collapsible defaultOpen={true}>
            <CollapsibleTrigger asChild>
                 <Button variant="ghost" className="flex items-center gap-2 pl-0 hover:bg-transparent text-3xl font-bold font-headline text-primary mb-4">
                    <ChevronsUpDown className="h-6 w-6 text-muted-foreground" />
                    <h2>Auto-Shipments</h2>
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <AutoShipTable />
            </CollapsibleContent>
        </Collapsible>

        <Collapsible defaultOpen={true}>
            <CollapsibleTrigger asChild>
                 <Button variant="ghost" className="flex items-center gap-2 pl-0 hover:bg-transparent text-3xl font-bold font-headline text-primary mb-4">
                    <ChevronsUpDown className="h-6 w-6 text-muted-foreground" />
                    <h2>Subscription Services</h2>
                </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
                <SubscriptionTable />
            </CollapsibleContent>
        </Collapsible>
      </main>
    </div>
  );
}
