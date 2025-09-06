
import { getAccountDetails, getTransactionsForAccount } from '@/services/monthly-budget-service';
import { getAccounts } from '@/services/account-details-service';
import { getBudgetCategories } from '@/services/budget-category-service';
import { AccountClientPage } from '@/components/account-client-page';
import { notFound } from 'next/navigation';

export default async function AccountDetailPage({ params }: { params: { accountId: string } }) {
  const { accountId } = params;

  const [account, transactions, allAccounts, categories] = await Promise.all([
    getAccountDetails(accountId),
    getTransactionsForAccount(accountId),
    getAccounts(),
    getBudgetCategories()
  ]);

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
