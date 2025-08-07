'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Wand2, Loader2, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

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
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { Task, TaskFrequency, LinkGroup } from '@/types';
import { generateTaskDescription } from '@/ai/flows/generate-task-description';
import { useLinkGroups } from '@/hooks/use-link-groups';

const formSchema = z.object({
  description: z.string().min(3, 'Description must be at least 3 characters long.'),
  details: z.string().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly'], {
    required_error: 'Please select a frequency.',
  }),
  dueDate: z.date().optional(),
  linkGroupId: z.string().optional(),
});

type TaskFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  addTask: (task: Omit<Task, 'id' | 'completed' | 'completedAt' | 'subtasks' | 'order'>) => void;
  updateTask: (id: string, task: Partial<Omit<Task, 'id' | 'subtasks'>>) => void;
  editingTask: Task | null;
};

export function TaskForm({ open, onOpenChange, addTask, updateTask, editingTask }: TaskFormProps) {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const { toast } = useToast();
  const { linkGroups, isLoading: isLoadingLinkGroups } = useLinkGroups();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      details: '',
      frequency: 'daily',
      dueDate: undefined,
      linkGroupId: '',
    },
  });

  useEffect(() => {
    if (editingTask) {
      form.reset({
        description: editingTask.description,
        details: editingTask.details || '',
        frequency: editingTask.frequency,
        dueDate: editingTask.dueDate ? new Date(editingTask.dueDate) : undefined,
        linkGroupId: editingTask.linkGroupId || '',
      });
    } else {
      form.reset({
        description: '',
        details: '',
        frequency: 'daily',
        dueDate: undefined,
        linkGroupId: '',
      });
    }
  }, [editingTask, form, open]);


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
    const submissionData = {
      ...values,
      dueDate: values.dueDate ? values.dueDate.toISOString() : null,
      frequency: values.frequency as TaskFrequency,
      linkGroupId: values.linkGroupId || null,
    };

    if (editingTask) {
        updateTask(editingTask.id, submissionData);
    } else {
        addTask(submissionData as Omit<Task, 'id' | 'completed' | 'completedAt' | 'subtasks' | 'order'>);
    }
    form.reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editingTask ? 'Edit task' : 'Add a new task'}</DialogTitle>
          <DialogDescription>
             {editingTask ? 'Update the details for your task.' : 'Fill in the details for your new budgeting task.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input placeholder="e.g., Review weekly spending" {...field} />
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
              name="details"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Details (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Add more details about the task..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
                <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
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
                
                <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                    <FormItem className="flex flex-col">
                    <FormLabel>Due Date (Optional)</FormLabel>
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
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                    <FormMessage />
                    </FormItem>
                )}
                />
            </div>
            
            <FormField
              control={form.control}
              name="linkGroupId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link Group (Optional)</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={isLoadingLinkGroups}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a link group" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {linkGroups.map(group => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit">{editingTask ? 'Save Changes' : 'Add Task'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
