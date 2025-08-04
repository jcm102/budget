
'use client';

import { useState } from 'react';
import { useCategories } from '@/hooks/use-categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusCircle, Trash2 } from 'lucide-react';
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

export function CategoryList() {
  const { categories, addCategory, deleteCategory, isLoading } = useCategories();
  const [newCategoryName, setNewCategoryName] = useState('');

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      addCategory({ name: newCategoryName.trim() });
      setNewCategoryName('');
    }
  };
  
  const renderLoadingSkeleton = () => (
    Array.from({ length: 3 }).map((_, i) => (
      <div key={`skeleton-${i}`} className="flex items-center justify-between p-4 border-b">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>
    ))
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income Categories</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleAddCategory} className="flex items-center gap-2 mb-4">
          <Input
            placeholder="New category name..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
          />
          <Button type="submit" disabled={!newCategoryName.trim()}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add
          </Button>
        </form>

        <div className="space-y-2">
          {isLoading ? (
            renderLoadingSkeleton()
          ) : categories.length > 0 ? (
            categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-md p-3 bg-secondary/50"
              >
                <span className="font-medium">{category.name}</span>
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
                        This will permanently delete the &quot;{category.name}&quot; category.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deleteCategory(category.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No categories yet. Add one to get started!
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
