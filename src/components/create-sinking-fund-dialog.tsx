
'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMonthlyBudget } from '@/hooks/use-monthly-budget';
import type { SubscriptionItem, AutoShipItem, Category } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const formSchema = z.object({
  categoryId: z.string().min(1, 'Please select a budget category.'),
});

type CreateSinkingFundDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: SubscriptionItem | AutoShipItem;
  itemType: 'Subscription' | 'Auto-Shipment';
  onConfirm: (categoryId: string) => void;
};

type CategoryWithChildren = Category & { children: CategoryWithChildren[] };

const getMonthlyCost = (item: SubscriptionItem | AutoShipItem) => {
    if (item.type === 'Subscription') {
        switch (item.billingFrequency) {
            case 'Annually': return item.cost / 12;
            case 'Quarterly': return item.cost / 3;
            case 'Monthly': default: return item.cost;
        }
    } else { // AutoShipItem
        const frequencyMap = { 'Monthly': 1, 'Every 2 Months': 2, 'Every 3 Months': 3, 'Every 4 Months': 4, 'Every 6 Months': 6 };
        return item.estimatedCost / frequencyMap[item.frequency];
    }
}

export function CreateSinkingFundDialog({ open, onOpenChange, item, itemType, onConfirm }: CreateSinkingFundDialogProps) {
  const { categories, isLoading: isLoadingCategories } = useMonthlyBudget();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { categoryId: '' },
  });

  const categoryTree = useMemo(() => {
    const tree: CategoryWithChildren[] = [];
    const map: { [key: string]: CategoryWithChildren } = {};
    categories.forEach(cat => map[cat.id] = { ...cat, children: [] });
    categories.forEach(cat => {
      if (cat.parentId && map[cat.parentId]) {
        map[cat.parentId].children.push(map[cat.id]);
      } else {
        tree.push(map[cat.id]);
      }
    });
    return tree;
  }, [categories]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    onConfirm(values.categoryId);
    onOpenChange(false);
  }

  const monthlyCost = getMonthlyCost(item);
  const itemName = item.type === 'Subscription' ? item.serviceName : item.item;

  const renderCategoryOptions = (nodes: CategoryWithChildren[], level = 0) => {
    let options: JSX.Element[] = [];
    nodes.forEach(node => {
        options.push(
            <SelectItem key={node.id} value={node.id} style={{ paddingLeft: `${1 + level * 1}rem` }}>
                {node.name}
            </SelectItem>
        );
        if (node.children.length > 0) {
            options = options.concat(renderCategoryOptions(node.children, level + 1));
        }
    });
    return options;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Sinking Fund</DialogTitle>
          <DialogDescription>
            This will create a new sinking fund and add a corresponding item to your monthly budget.
          </DialogDescription>
        </DialogHeader>

        <Card className="bg-secondary/50">
            <CardHeader className="p-4">
                <CardTitle className="text-base">{itemName}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-sm">
                 <div className="flex justify-between">
                    <span>Monthly Savings Needed:</span>
                    <span className="font-medium">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(monthlyCost)}</span>
                </div>
            </CardContent>
        </Card>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Budget Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoadingCategories}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a budget category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {renderCategoryOptions(categoryTree)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit">Create Fund</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

