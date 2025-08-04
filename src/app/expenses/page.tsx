'use client';

import { Button } from '@/components/ui/button';
import { ExpenseTable } from '@/components/expense-table';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MileageTable } from '@/components/mileage-table';
import { Banknote, Car } from 'lucide-react';

export default function ExpensesPage() {
  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8">
      <header className="mb-8">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </header>
      <main>
        <Tabs defaultValue="monetary" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-secondary/50 mb-6">
            <TabsTrigger value="monetary"><Banknote className="mr-2 h-4 w-4" />Monetary Expenses</TabsTrigger>
            <TabsTrigger value="mileage"><Car className="mr-2 h-4 w-4" />Mileage Log</TabsTrigger>
          </TabsList>
          <TabsContent value="monetary">
            <ExpenseTable />
          </TabsContent>
          <TabsContent value="mileage">
            <MileageTable />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
