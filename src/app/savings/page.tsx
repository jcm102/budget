
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
import { useAccounts } from '@/hooks/use-accounts';
import { useSelectedAccount } from '@/hooks/use-selected-account';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLedgerSettings } from '@/hooks/use-ledger-settings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';


export default function SavingsPage() {
  const { accounts, isLoading: isLoadingAccounts } = useAccounts();
  const { selectedAccountId, setSelectedAccountId } = useSelectedAccount();
  const { includeGoalSavings, setIncludeGoalSavings, includeSinkingFunds, setIncludeSinkingFunds } = useLedgerSettings();

  const handlePrint = () => {
    window.print();
  };
  
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-between">
                  {selectedAccount ? selectedAccount.name : 'Select Account'}
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px]">
                {isLoadingAccounts ? (
                  <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
                ) : (
                  accounts.map(account => (
                    <DropdownMenuItem 
                      key={account.id} 
                      onSelect={() => setSelectedAccountId(account.id)}
                      disabled={account.id === selectedAccountId}
                    >
                      {account.name}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
            <AccountLedgerTable key={selectedAccountId} accountId={selectedAccountId} />
          </TabsContent>

          <TabsContent value="goals">
            <div className="flex justify-between items-start mb-4">
              <div>
                 <h2 className="text-2xl font-bold font-headline text-primary">Goal Savings</h2>
                  <p className="text-muted-foreground mt-2 max-w-2xl">
                    Track savings for specific, tangible goals.
                  </p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  id="include-goals-switch" 
                  checked={includeGoalSavings}
                  onCheckedChange={setIncludeGoalSavings}
                  />
                <Label htmlFor="include-goals-switch">Include in Ledger</Label>
              </div>
            </div>
            <GoalTable />
          </TabsContent>

          <TabsContent value="funds">
             <div className="flex justify-between items-start mb-4">
                <div>
                    <h2 className="text-2xl font-bold font-headline text-primary">Sinking Funds</h2>
                    <p className="text-muted-foreground mt-2 max-w-2xl">
                        Set aside money for anticipated future expenses. Link subscriptions and auto-shipments to automatically calculate what you need to save each month.
                    </p>
                </div>
                 <div className="flex items-center space-x-2">
                    <Switch 
                      id="include-funds-switch" 
                      checked={includeSinkingFunds}
                      onCheckedChange={setIncludeSinkingFunds}
                      />
                    <Label htmlFor="include-funds-switch">Include in Ledger</Label>
                  </div>
            </div>
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
