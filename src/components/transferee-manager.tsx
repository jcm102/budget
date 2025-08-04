'use client';

import { useState } from 'react';
import { useTransferees } from '@/hooks/use-transferees';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export function TransfereeManager() {
  const { transferees, addTransferee, deleteTransferee, isLoading } = useTransferees();
  const [newTransferee, setNewTransferee] = useState('');

  const handleAddTransferee = () => {
    if (newTransferee.trim()) {
      addTransferee(newTransferee.trim());
      setNewTransferee('');
    }
  };

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
        <CardTitle>Transferee Accounts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="New account name"
            value={newTransferee}
            onChange={(e) => setNewTransferee(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTransferee()}
          />
          <Button onClick={handleAddTransferee}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {isLoading ? (
            renderLoadingSkeleton()
          ) : transferees.length > 0 ? (
            transferees.map((transferee) => (
              <div
                key={transferee.id}
                className="flex items-center justify-between p-2 border rounded-md"
              >
                <span>{transferee.name}</span>
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
                        This will permanently delete the &quot;{transferee.name}&quot; account.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteTransferee(transferee.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center p-4">
              No transferee accounts yet. Add one to get started.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
