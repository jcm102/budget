'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy, addDoc, deleteDoc, doc, where, getDocs, limit } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
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
import { useToast } from '@/hooks/use-toast';

interface Payee {
  id: string;
  name: string;
}

export function PayeeManager() {
  const [payees, setPayees] = useState<Payee[]>([]);
  const [newPayee, setNewPayee] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const db = useFirestore();

  useEffect(() => {
    if (!db) return;

    setIsLoading(true);

    const q = query(
      collection(db, 'payees'),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name
      } as Payee));
      setPayees(list);
      setIsLoading(false);
    }, (error) => {
      console.error('Failed to listen to payees:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const handleAddPayee = async () => {
    if (!db) return;
    const name = newPayee.trim();
    if (!name) return;

    try {
      // Check if duplicate
      const duplicateQuery = query(collection(db, 'payees'), where('name', '==', name), limit(1));
      const duplicateSnap = await getDocs(duplicateQuery);
      if (!duplicateSnap.empty) {
        toast({
          title: 'Duplicate Payee',
          description: `"${name}" is already in your payees list.`,
          variant: 'destructive'
        });
        return;
      }

      await addDoc(collection(db, 'payees'), {
        name,
        createdAt: new Date().toISOString()
      });
      setNewPayee('');
      toast({
        title: 'Payee Added',
        description: `"${name}" has been added to your payees list.`
      });
    } catch (error) {
      console.error('Failed to add payee:', error);
      toast({
        title: 'Error',
        description: 'Failed to add payee.',
        variant: 'destructive'
      });
    }
  };

  const handleDeletePayee = async (id: string, name: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'payees', id));
      toast({
        title: 'Payee Deleted',
        description: `"${name}" has been removed from your payees list.`
      });
    } catch (error) {
      console.error('Failed to delete payee:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete payee.',
        variant: 'destructive'
      });
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
        <CardTitle>Manage Payees</CardTitle>
        <CardDescription>
          Manually add new payees or delete existing ones. Payees will also be added automatically when typed into a transaction.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="New payee name..."
            value={newPayee}
            onChange={(e) => setNewPayee(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddPayee()}
          />
          <Button onClick={handleAddPayee}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>

        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {isLoading ? (
            renderLoadingSkeleton()
          ) : payees.length > 0 ? (
            payees.map((payee) => (
              <div
                key={payee.id}
                className="flex items-center justify-between p-2 border rounded-md"
              >
                <span className="font-medium">{payee.name}</span>
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
                        This will permanently delete &quot;{payee.name}&quot; from your autocompletion suggestions. Existing transactions containing this payee will not be affected.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleDeletePayee(payee.id, payee.name)} 
                        className={cn(buttonVariants({ variant: "destructive" }))}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center p-4">
              No payees registered yet. Type one during a transaction or add it here.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
