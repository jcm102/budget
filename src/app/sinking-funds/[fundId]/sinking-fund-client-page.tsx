
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Repeat } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { SinkingFundTransaction, SavingsItem } from '@/types';
import * as SavingsService from '@/services/savings-service';
import { useUser, useFirestore } from '@/firebase';

const parseDate = (dateString: string) => {
    return new Date(dateString);
};

const formatCurrency = (amount: number, currency: 'CAD' | 'USD' = 'USD') => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

export function SinkingFundClientPage({ fundId, initialTransactions }: { fundId: string, initialTransactions: SinkingFundTransaction[]}) {
  const [transactions, setTransactions] = useState<SinkingFundTransaction[]>(initialTransactions);
  const [fundDetails, setFundDetails] = useState<SavingsItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();
  const db = useFirestore();

  const fetchFundDetails = async () => {
    if (!db) return;
    // This is a simplified fetch. In a real app, you might get this from a context or a more robust fetching mechanism.
    const allSavingsItems = await SavingsService.getSavingsItems(db, user?.uid || ''); // This is inefficient but works for now.
    const fund = allSavingsItems.find(item => item.id === fundId);
    setFundDetails(fund || null);
    setIsLoading(false);
  }

  const fetchTransactions = async () => {
    if (!db) return;
    const fetchedTransactions = await SavingsService.getSinkingFundTransactions(db, fundId);
    setTransactions(fetchedTransactions);
  }
  
  useEffect(() => {
    if (user && db) {
        fetchFundDetails();
    }
  }, [user, fundId, db]);

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
        {isLoading ? (
          <>
            <Skeleton className="h-10 w-3/4 mb-4" />
            <Skeleton className="h-8 w-1/2 mb-8" />
          </>
        ) : (
          <>
            <h1 className="text-3xl font-bold font-headline text-primary mb-2">{fundDetails?.name}</h1>
            <p className="text-2xl font-semibold mb-8">{formatCurrency(fundDetails?.amount || 0, fundDetails?.currency)}</p>
          </>
        )}

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
                <CardTitle>Transaction History</CardTitle>
                 <Button variant="outline" size="icon" onClick={fetchTransactions} className="h-8 w-8">
                    <Repeat className="h-4 w-4" />
                    <span className="sr-only">Refresh Transactions</span>
                </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.length > 0 ? (
                  transactions.map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell>{format(parseDate(tx.date), 'PPP')}</TableCell>
                      <TableCell className="capitalize">{tx.type}</TableCell>
                      <TableCell className={`text-right ${tx.type === 'deposit' ? 'text-green-600' : tx.type === 'withdraw' ? 'text-destructive' : ''}`}>
                        {tx.type === 'deposit' ? '+' : tx.type === 'withdraw' ? '-' : ''} {formatCurrency(tx.amount, fundDetails?.currency)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                      No transactions found for this fund.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
