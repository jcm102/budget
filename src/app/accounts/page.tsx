
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useAccountDetails } from '@/hooks/use-transferees';
import { useDebt } from '@/app/debt/hooks/use-debt';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';
import type { AccountDetails as AccountDetailsType } from '@/types';


const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};


function AccountCard({ account }: { account: AccountDetailsType & { debtBalance?: number }}) {
    const balance = account.type === 'Credit' ? (account.debtBalance || 0) : (account.balance || 0);
    const isNegative = balance > 0 && account.type === 'Credit';

    return (
        <Link href={`/accounts/${account.id}`} className="block">
            <Card className="hover:bg-accent transition-colors">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{account.name}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className={`text-2xl font-bold ${isNegative ? 'text-destructive' : ''}`}>
                        {formatCurrency(balance)}
                    </div>
                </CardContent>
            </Card>
        </Link>
    );
}

function AccountSection({ title, accounts }: { title: string, accounts: (AccountDetailsType & { debtBalance?: number })[]}) {
    if (accounts.length === 0) return null;

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold text-primary">{title}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {accounts.map(account => (
                    <AccountCard key={account.id} account={account} />
                ))}
            </div>
        </div>
    );
}

export default function AccountsPage() {
  const { accounts, isLoading: isLoadingAccounts } = useAccountDetails();
  const { debts, isLoading: isLoadingDebts } = useDebt();

  const isLoading = isLoadingAccounts || isLoadingDebts;

  const enrichedAccounts = useMemo(() => {
    return accounts.map(acc => {
      if (acc.type === 'Credit' && acc.linkedDebtId) {
        const linkedDebt = debts.find(d => d.id === acc.linkedDebtId);
        return { ...acc, debtBalance: linkedDebt?.balance || 0 };
      }
      return acc;
    });
  }, [accounts, debts]);

  const chequingAccounts = enrichedAccounts.filter(a => a.type === 'Chequing');
  const savingsAccounts = enrichedAccounts.filter(a => a.type === 'Savings');
  const creditAccounts = enrichedAccounts.filter(a => a.type === 'Credit');
  const giftCardAccounts = enrichedAccounts.filter(a => a.type === 'Gift Card');
  const iouAccounts = enrichedAccounts.filter(a => a.type === 'IOU');


  const renderSkeleton = () => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
    </div>
  );

  return (
    <div className="container mx-auto max-w-6xl p-4 md:p-8">
       <header className="mb-8 flex justify-between items-center">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
         <Button asChild>
          <Link href="/settings">
            Manage Accounts
          </Link>
        </Button>
      </header>
      <main className="space-y-8">
        <h1 className="text-3xl font-bold font-headline text-primary mb-6">Accounts Overview</h1>

        {isLoading ? (
            <div className="space-y-8">
                <div className="space-y-4">
                    <Skeleton className="h-8 w-48" />
                    {renderSkeleton()}
                </div>
                 <div className="space-y-4">
                    <Skeleton className="h-8 w-48" />
                    {renderSkeleton()}
                </div>
            </div>
        ) : (
            <>
                <AccountSection title="Chequing" accounts={chequingAccounts} />
                <AccountSection title="Savings" accounts={savingsAccounts} />
                <AccountSection title="Credit" accounts={creditAccounts} />
                <AccountSection title="Gift Cards" accounts={giftCardAccounts} />
                <AccountSection title="IOUs" accounts={iouAccounts} />
                {accounts.length === 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>No Accounts Found</CardTitle>
                            <CardDescription>
                                Go to Settings to add your chequing, savings, and credit accounts.
                            </CardDescription>
                        </CardHeader>
                    </Card>
                )}
            </>
        )}
      </main>
    </div>
  );
}
