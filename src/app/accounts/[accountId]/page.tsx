
'use client';

import { getAccountDetails, getTransactionsForAccount } from '@/app/monthly-budget/services/monthly-budget-service';
import { getAccounts } from '@/services/account-details-service';
import { getCategories } from '@/services/budget-category-service';
import { AccountClientPage } from '@/app/accounts/components/account-client-page';
import { notFound, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AccountDetails, Category, Transaction } from '@/types';
import { useUser } from '@/firebase';
import { Loader2 } from 'lucide-react';


export default function AccountDetailPage() {
  const params = useParams();
  const accountId = params.accountId as string;
  const { user, isUserLoading } = useUser();

  const [account, setAccount] = useState<AccountDetails | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allAccounts, setAllAccounts] = useState<AccountDetails[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && accountId) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const [accountData, transactionsData, allAccountsData, categoriesData] = await Promise.all([
            getAccountDetails(accountId),
            getTransactionsForAccount(accountId),
            getAccounts(),
            getCategories()
          ]);
          setAccount(accountData);
          setTransactions(transactionsData);
          setAllAccounts(allAccountsData);
          setCategories(categoriesData);
        } catch (error) {
          console.error("Failed to fetch account details:", error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchData();
    } else if (!isUserLoading && !user) {
        // Handle case where user is not logged in but tries to access the page
        setIsLoading(false);
    }
  }, [accountId, user, isUserLoading]);

  if (isLoading || isUserLoading) {
    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  if (!account) {
    notFound();
  }

  return (
    <AccountClientPage 
      account={account} 
      initialTransactions={transactions}
      allAccounts={allAccounts}
      allCategories={categories}
    />
  );
}
