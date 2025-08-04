'use client';

import { useState } from 'react';
import { useWorkCategories } from '@/hooks/use-work-categories';
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

export function WorkCategoryManager() {
  const { categories, addCategory, deleteCategory, isLoading } = useWorkCategories();
  const [newCategory, setNewCategory] = useState('');

  const handleAddCategory = () => {
    if (newCategory.trim()) {
      addCategory(newCategory.trim());
      setNewCategory('');
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
        <CardTitle>Work Expense Categories</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="New category name"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
          />
          <Button onClick={handleAddCategory}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {isLoading ? (
            renderLoadingSkeleton()
          ) : categories.length > 0 ? (
            categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between p-2 border rounded-md"
              >
                <span>{category.name}</span>
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
            <p className="text-muted-foreground text-center p-4">
              No custom work expense categories yet. Add one to get started.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
