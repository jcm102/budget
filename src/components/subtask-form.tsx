
'use client';

import { useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import type { Subtask } from '@/types';

const formSchema = z.object({
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  link: z.string().url().optional().or(z.literal('')),
});

type SubtaskFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: z.infer<typeof formSchema>) => void;
  editingSubtask: Omit<Subtask, 'id' | 'order' | 'completed'> | null;
};

export function SubtaskForm({ open, onOpenChange, onSave, editingSubtask }: SubtaskFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      link: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (editingSubtask) {
        form.reset({
          description: editingSubtask.description,
          link: editingSubtask.link || '',
        });
      } else {
        form.reset({
          description: '',
          link: '',
        });
      }
    }
  }, [editingSubtask, open, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    onSave(values);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingSubtask ? 'Edit Subtask' : 'Add New Subtask'}</DialogTitle>
          <DialogDescription>
            {editingSubtask ? 'Update the details for your subtask.' : 'Fill in the details for your new subtask.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Pay Visa bill" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="link"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit">{editingSubtask ? 'Save Changes' : 'Add Subtask'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
