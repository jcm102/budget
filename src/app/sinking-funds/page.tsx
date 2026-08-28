
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronsUpDown } from 'lucide-react';
import { SinkingFundTable } from '../savings/components/sinking-fund-table';
import { useAccountDetails } from '@/hooks/use-account-details';
import { useSelectedAccount } from '@/hooks/use-selected-account';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function SinkingFundsPage() {
  const { accounts, isLoading: isLoadingAccounts } = useAccountDetails();
  const { selectedAccountId, setSelectedAccountId } = useSelectedAccount();

  // Find currently selected account (excluding 'all')
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  return (
    <div className="container mx-auto max-w-4xl p-4 md:p-8">
       <header className="mb-8 flex justify-between items-center no-print">
        <Button asChild variant="outline">
          <Link href="/savings">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Savings
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[200px] justify-between">
                {selectedAccountId === 'all' ? 'All Accounts' : (selectedAccount ? selectedAccount.name : 'Select Account')}
                <ChevronsUpDown className="h-4 w-4 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-[200px]">
              {isLoadingAccounts ? (
                <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem 
                    onSelect={() => setSelectedAccountId('all')}
                    disabled={selectedAccountId === 'all'}
                  >
                    All Accounts
                  </DropdownMenuItem>
                  {accounts.filter(a => a.type === 'Savings').map(account => (
                    <DropdownMenuItem 
                      key={account.id} 
                      onSelect={() => setSelectedAccountId(account.id)}
                      disabled={selectedAccountId === account.id}
                    >
                      {account.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main>
        <h1 className="text-3xl font-bold font-headline text-primary mb-6">Sinking Funds</h1>
        <SinkingFundTable />
      </main>
    </div>
  );
}
