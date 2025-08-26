
'use client';

import { useState } from 'react';
import { useAccounts } from '@/hooks/use-accounts';
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

export function AccountManager() {
  const { accounts, addAccount, deleteAccount, isLoading } = useAccounts();
  const [newAccount, setNewAccount] = useState('');

  const handleAddAccount = () => {
    if (newAccount.trim()) {
      addAccount(newAccount.trim());
      setNewAccount('');
    }
  };

  const renderLoadingSkeleton = () => (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Savings Accounts</CardTitle>
        <CardDescription>
          Add or remove accounts for the Future Spending page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="New account name"
            value={newAccount}
            onChange={(e) => setNewAccount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddAccount()}
          />
          <Button onClick={handleAddAccount} disabled={isLoading}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {isLoading ? (
            renderLoadingSkeleton()
          ) : accounts.length > 0 ? (
            accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-2 border rounded-md"
              >
                <span>{account.name}</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" disabled={accounts.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the &quot;{account.name}&quot; account and all associated funds and goals. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteAccount(account.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
