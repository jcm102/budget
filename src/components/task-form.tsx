'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from 'date-fns';
import { Wand2, Calendar as CalendarIcon, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Task, TaskFrequency } from '@/types';
import { generateTaskDescription } from '@/ai/flows/generate-task-description';

const formSchema = z.object({
  description: z.string().min(3, 'Description must be at least 3 characters long.'),
  dueDate: z.date({
    required_error: 'A due date is required.',
  }),
  frequency: z.enum(['daily', 'weekly', 'monthly'], {
    required_error: 'Please select a frequency.',
  }),
});

type TaskFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addTask: (task: Omit<Task, 'id' | 'completed'>) => void;
};

export function TaskForm({ open, onOpenChange, addTask }: TaskFormProps) {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      frequency: 'daily',
    },
  });

  const handleGenerateDescription = async () => {
    const currentDesc = form.getValues('description');
    if (!currentDesc.trim()) {
      toast({
        title: 'Uh oh!',
        description: 'Please enter a description before using AI refinement.',
        variant: 'destructive',
      });
      return;
    }
    setIsAiLoading(true);
    try {
      const result = await generateTaskDescription({ taskDescription: currentDesc });
      form.setValue('description', result.refinedTaskDescription, {
        shouldValidate: true,
      });
      toast({
        title: 'Success!',
        description: 'Task description has been refined by AI.',
      });
    } catch (error) {
      console.error('AI refinement failed:', error);
      toast({
        title: 'Error',
        description: 'Failed to refine description with AI. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  function onSubmit(values: z.infer<typeof formSchema>) {
    addTask({
      ...values,
      dueDate: values.dueDate.toISOString(),
      frequency: values.frequency as TaskFrequency,
    });
    form.reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add a new task</DialogTitle>
          <DialogDescription>
            Fill in the details for your new budgeting task.
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
                    <div className="relative">
                      <Textarea placeholder="e.g., Review weekly spending" {...field} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute bottom-1 right-1 h-7 w-7"
                        onClick={handleGenerateDescription}
                        disabled={isAiLoading}
                        aria-label="Refine with AI"
                      >
                        {isAiLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4 text-primary" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Due Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={'outline'}
                          className={cn(
                            'w-full pl-3 text-left font-normal',
                            !field.value && 'text-muted-foreground'
                          )}
                        >
                          {field.value ? (
                            format(field.value, 'PPP')
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date('1900-01-01')}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="frequency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Frequency</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="How often does this task repeat?" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit">Add Task</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
