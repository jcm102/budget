'use client';

import { getAccountDetails, getTransactionsForAccount } from '@/app/monthly-budget/services/monthly-budget-service';
import { getAccounts } from '@/services/account-details-service';
import { getCategories } from '@/services/budget-category-service';
import { AccountClientPage } from '@/app/accounts/components/account-client-page';
import { notFound, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AccountDetails, Category, Transaction } from '@/types';
import { useUser } from '@/firebase';

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
    if (user) {
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
    }
  }, [accountId, user]);

  if (isLoading || isUserLoading) {
    return <div>Loading...</div>; // Or a proper skeleton loader
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
