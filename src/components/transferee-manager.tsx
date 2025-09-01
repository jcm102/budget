
'use client';

import { useState, useMemo } from 'react';
import { useAccountDetails } from '@/hooks/use-transferees';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trash2, PlusCircle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { useDebt } from '@/hooks/use-debt';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AccountDetails, AccountType, Debt } from '@/types';

function AccountRow({ account, onUpdate, onDelete, debts, isLoadingDebts }: { account: AccountDetails, onUpdate: (id: string, field: keyof AccountDetails, value: any) => void, onDelete: (id: string) => void, debts: Debt[], isLoadingDebts: boolean }) {
  return (
    <div
      key={account.id}
      className="grid grid-cols-4 items-center gap-2 p-2 border rounded-md"
    >
      <Input
        defaultValue={account.name}
        onBlur={(e) => onUpdate(account.id, 'name', e.target.value)}
        placeholder="Account Name"
        className="col-span-2 md:col-span-1"
      />
      <Select
        value={account.type}
        onValueChange={(value: AccountType) => onUpdate(account.id, 'type', value)}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="Chequing">Chequing</SelectItem>
          <SelectItem value="Savings">Savings</SelectItem>
          <SelectItem value="Credit">Credit</SelectItem>
          <SelectItem value="Gift Card">Gift Card</SelectItem>
          <SelectItem value="IOU">IOU</SelectItem>
        </SelectContent>
      </Select>

      {account.type === 'Credit' ? (
        <Select
          value={account.linkedDebtId || 'null'}
          onValueChange={(value) => onUpdate(account.id, 'linkedDebtId', value === 'null' ? null : value)}
          disabled={isLoadingDebts}
        >
          <SelectTrigger><SelectValue placeholder="Link to Debt Worksheet" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="null">None</SelectItem>
            {debts.map(debt => (
              <SelectItem key={debt.id} value={debt.id}>{debt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type="number"
          defaultValue={account.balance}
          onBlur={(e) => onUpdate(account.id, 'balance', parseFloat(e.target.value) || 0)}
          placeholder="Balance"
        />
      )}

      <div className="text-right">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the &quot;{account.name}&quot; account.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(account.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}


export function AccountDetailsManager() {
  const { accounts, addAccount, updateAccount, deleteAccount, isLoading } = useAccountDetails();
  const { debts, isLoading: isLoadingDebts } = useDebt();

  const handleUpdate = (id: string, field: keyof AccountDetails, value: any) => {
    updateAccount(id, { [field]: value });
  };

  const handleAddNew = () => {
    addAccount({ name: "New Account", type: "Chequing", balance: 0, linkedDebtId: null });
  };
  
  const groupedAccounts = useMemo(() => {
    const groups: Record<AccountType, AccountDetails[]> = {
      'Chequing': [],
      'Savings': [],
      'Credit': [],
      'Gift Card': [],
      'IOU': [],
    };
    accounts.forEach(account => {
      if (groups[account.type]) {
        groups[account.type].push(account);
      }
    });
    return groups;
  }, [accounts]);

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
        <CardTitle>Payment/Transfer Accounts</CardTitle>
        <CardDescription>
          Manage the accounts used for payments and transfers across the app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          renderLoadingSkeleton()
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedAccounts).map(([type, accs]) => {
              if (accs.length === 0) return null;
              return (
                <div key={type} className="space-y-2">
                  <h4 className="font-semibold text-primary">{type}</h4>
                  <div className="space-y-2">
                    {accs.map(account => (
                      <AccountRow
                        key={account.id}
                        account={account}
                        onUpdate={handleUpdate}
                        onDelete={deleteAccount}
                        debts={debts}
                        isLoadingDebts={isLoadingDebts}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
             {accounts.length === 0 && (
                <p className="text-muted-foreground text-center p-4">
                    No payment source accounts yet. Add one to get started.
                </p>
             )}
          </div>
        )}
        <Button onClick={handleAddNew} className="mt-4">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Account
        </Button>
      </CardContent>
    </Card>
  );
}
