
'use client';

import React, { useState, useMemo } from 'react';
import { useBudgetCategories } from '@/hooks/use-budget-categories';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trash2, PlusCircle, ChevronRight, CornerDownRight } from 'lucide-react';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';
import { Skeleton } from './ui/skeleton';
import type { Category } from '@/types';

function CategoryItem({
  category,
  children,
  onDelete,
  onAddSubCategory,
}: {
  category: Category;
  children: React.ReactNode;
  onDelete: (id: string) => void;
  onAddSubCategory: (parentId: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center justify-between p-2 border rounded-md group">
        <div className="flex items-center gap-1">
          <CollapsibleTrigger asChild>
             <Button variant="ghost" size="icon" className="h-8 w-8" disabled={!children}>
                <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
             </Button>
          </CollapsibleTrigger>
          <span>{category.name}</span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
           <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onAddSubCategory(category.id)}>
              <PlusCircle className="h-4 w-4" />
           </Button>
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
                  This will permanently delete the &quot;{category.name}&quot; category. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(category.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
       <CollapsibleContent>
         <div className="pl-6 pt-2 space-y-2">
            {children}
         </div>
       </CollapsibleContent>
    </Collapsible>
  );
}

export function BudgetCategoryManager() {
  const { categories, addCategory, deleteCategory, isLoading } = useBudgetCategories();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingToParentId, setAddingToParentId] = useState<string | null>(null);

  const handleAddCategory = (parentId: string | null = null) => {
    if (newCategoryName.trim()) {
      addCategory(newCategoryName.trim(), parentId);
      setNewCategoryName('');
      setAddingToParentId(null);
    }
  };
  
  const handleInitiateAdd = (parentId: string | null) => {
      setAddingToParentId(parentId);
      setNewCategoryName('');
  }

  const categoryTree = useMemo(() => {
    const tree: (Category & { children: Category[] })[] = [];
    const map: Record<string, Category & { children: Category[] }> = {};

    categories.forEach(cat => {
      map[cat.id] = { ...cat, children: [] };
    });

    categories.forEach(cat => {
      if (cat.parentId && map[cat.parentId]) {
        map[cat.parentId].children.push(map[cat.id]);
      } else {
        tree.push(map[cat.id]);
      }
    });

    return tree;
  }, [categories]);

  const renderCategoryTree = (nodes: (Category & { children: Category[] })[]) => {
    return nodes.map(node => (
      <CategoryItem
        key={node.id}
        category={node}
        onDelete={deleteCategory}
        onAddSubCategory={handleInitiateAdd}
      >
        {node.children.length > 0 && renderCategoryTree(node.children)}
        {addingToParentId === node.id && (
             <div className="flex gap-2 items-center pl-4">
                 <CornerDownRight className="h-4 w-4 text-muted-foreground" />
                <Input
                    autoFocus
                    placeholder="New subcategory name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCategory(node.id)}
                    onBlur={() => setAddingToParentId(null)}
                    className="h-9"
                />
            </div>
        )}
      </CategoryItem>
    ));
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
        <CardTitle>Budget Categories</CardTitle>
        <CardDescription>Manage categories and subcategories for the Monthly Budget page.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Input
            placeholder="New top-level category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory(null)}
          />
          <Button onClick={() => handleAddCategory(null)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {isLoading ? (
            renderLoadingSkeleton()
          ) : categoryTree.length > 0 ? (
            renderCategoryTree(categoryTree)
          ) : (
            <p className="text-muted-foreground text-center p-4">
              No budget categories yet. Add one to get started.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
