
'use client';

import { useAccountDetails } from '@/hooks/use-account-details';
import { useCommonAccounts } from '@/hooks/use-common-accounts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from './ui/skeleton';

export function CommonlyUsedAccountsManager() {
  const { accounts, isLoading: isLoadingAccounts } = useAccountDetails();
  const { commonAccountIds, toggleCommonAccount, isLoading: isLoadingCommon } = useCommonAccounts();

  const isLoading = isLoadingAccounts || isLoadingCommon;

  const renderLoadingSkeleton = () => (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commonly Used Accounts</CardTitle>
        <CardDescription>
          Select which accounts should appear at the top of dropdown lists for quick access.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {isLoading ? (
            renderLoadingSkeleton()
          ) : accounts.length > 0 ? (
            accounts.map((account) => (
              <div key={account.id} className="flex items-center space-x-2 p-2 border rounded-md">
                <Checkbox
                  id={`common-${account.id}`}
                  checked={commonAccountIds.includes(account.id)}
                  onCheckedChange={(checked) => toggleCommonAccount(account.id, !!checked)}
                />
                <Label htmlFor={`common-${account.id}`} className="font-medium cursor-pointer">
                  {account.name}
                </Label>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center p-4">
              No accounts created yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
