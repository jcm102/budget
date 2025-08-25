
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SavingsTable } from '@/components/savings-table';
import { ArrowLeft, Printer, PiggyBank, Landmark, Truck, Repeat, Star, ChevronsUpDown } from 'lucide-react';
import { GoalTable } from '@/components/goal-table';
import { AutoShipTable } from '@/components/autoship-table';
import { SubscriptionTable } from '@/components/subscription-table';
import { AccountLedgerTable } from '@/components/account-ledger-table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


export default function SavingsPage() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-8">
       <header className="mb-8 flex justify-between items-center no-print">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
        <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold font-headline text-primary hidden md:block">
                Future Spending
            </h1>
            <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" />
                Print
            </Button>
        </div>
      </header>
      <main>
        <Tabs defaultValue="ledger" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 bg-secondary/50 mb-6 no-print h-auto">
            <TabsTrigger value="ledger" className="py-2"><Landmark className="mr-2 h-4 w-4"/>Account Ledger</TabsTrigger>
            <TabsTrigger value="goals" className="py-2"><Star className="mr-2 h-4 w-4"/>Goal Savings</TabsTrigger>
            <TabsTrigger value="funds" className="py-2"><PiggyBank className="mr-2 h-4 w-4"/>Sinking Funds</TabsTrigger>
            <TabsTrigger value="autoship" className="py-2"><Truck className="mr-2 h-4 w-4"/>Auto-Shipments</TabsTrigger>
            <TabsTrigger value="subscriptions" className="py-2"><Repeat className="mr-2 h-4 w-4"/>Subscriptions</TabsTrigger>
          </TabsList>
          
          <TabsContent value="ledger">
            <h2 className="text-2xl font-bold font-headline text-primary mb-4">Account Ledger</h2>
            <p className="text-muted-foreground mb-6 max-w-2xl">
              This is the master ledger for your future spending account. It includes balances from your sinking funds and goals.
            </p>
            <AccountLedgerTable />
          </TabsContent>

          <TabsContent value="goals">
             <h2 className="text-2xl font-bold font-headline text-primary mb-4">Goal Savings</h2>
              <p className="text-muted-foreground mb-6 max-w-2xl">
                Track savings for specific, tangible goals.
              </p>
            <GoalTable />
          </TabsContent>

          <TabsContent value="funds">
            <h2 className="text-2xl font-bold font-headline text-primary mb-4">Sinking Funds</h2>
            <p className="text-muted-foreground mb-6 max-w-2xl">
                Set aside money for anticipated future expenses. Link subscriptions and auto-shipments to automatically calculate what you need to save each month.
            </p>
            <SavingsTable />
          </TabsContent>

          <TabsContent value="autoship">
             <h2 className="text-2xl font-bold font-headline text-primary mb-4">Auto-Shipments</h2>
              <p className="text-muted-foreground mb-6 max-w-2xl">
                Keep track of items that are on auto-shipment, their next shipment date, and their cost.
              </p>
            <AutoShipTable />
          </TabsContent>

          <TabsContent value="subscriptions">
             <h2 className="text-2xl font-bold font-headline text-primary mb-4">Subscriptions</h2>
              <p className="text-muted-foreground mb-6 max-w-2xl">
                Manage all your recurring subscriptions and see their true monthly and annual costs.
              </p>
            <SubscriptionTable />
          </TabsContent>

        </Tabs>
      </main>
    </div>
  );
}
