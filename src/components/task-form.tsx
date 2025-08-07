'use client';

import { useEffect, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import * as z from 'zod';
import { Wand2, Loader2, CalendarIcon, PlusCircle, Trash2 } from 'lucide-react';
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
import type { Task, TaskFrequency } from '@/types';
import { generateTaskDescription } from '@/ai/flows/generate-task-description';
import { useLinkGroups } from '@/hooks/use-link-groups';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';

const formSchema = z.object({
  description: z.string().min(3, 'Description must be at least 3 characters long.'),
  details: z.string().optional(),
  frequency: z.enum(['daily', 'weekly', 'monthly'], {
    required_error: 'Please select a frequency.',
  }),
  dueDate: z.date().optional(),
  linkType: z.enum(['none', 'group', 'manual', 'internal']).default('none'),
  linkGroupId: z.string().optional(),
  links: z.array(z.object({ value: z.string().min(1, { message: "Link cannot be empty."}) })).optional(),
  internalLink: z.string().optional(),
});

const internalPages = [
    { value: '/', label: 'Home' },
    { value: '/debt', label: 'Debt Payment Worksheet' },
    { value: '/budget', label: 'Budget Overview' },
    { value: '/expenses', label: 'Work Expense Tracking' },
    { value: '/savings', label: 'Future Spending' },
    { value: '/settings', label: 'Settings' },
];

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
      linkType: 'none',
      linkGroupId: '',
      links: [{ value: '' }],
      internalLink: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "links"
  });

  const linkType = form.watch('linkType');

  useEffect(() => {
    if (editingTask) {
      let type: 'group' | 'manual' | 'none' | 'internal' = 'none';
      let internalLinkValue = '';

      if (editingTask.linkGroupId) {
        type = 'group';
      } else if (editingTask.links && editingTask.links.length > 0) {
        const isInternal = internalPages.some(p => p.value === editingTask.links![0]);
        if (isInternal) {
            type = 'internal';
            internalLinkValue = editingTask.links![0];
        } else {
            type = 'manual';
        }
      }
      form.reset({
        description: editingTask.description,
        details: editingTask.details || '',
        frequency: editingTask.frequency,
        dueDate: editingTask.dueDate ? new Date(editingTask.dueDate) : undefined,
        linkType: type,
        linkGroupId: editingTask.linkGroupId || '',
        links: editingTask.links && editingTask.links.length > 0 ? editingTask.links.map(l => ({value: l})) : [{ value: '' }],
        internalLink: internalLinkValue,
      });
    } else {
      form.reset({
        description: '',
        details: '',
        frequency: 'daily',
        dueDate: undefined,
        linkType: 'none',
        linkGroupId: '',
        links: [{ value: '' }],
        internalLink: '',
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
    let links: string[] = [];
    if (values.linkType === 'manual') {
        links = values.links?.map(l => l.value).filter(Boolean) || [];
    } else if (values.linkType === 'internal' && values.internalLink) {
        links = [values.internalLink];
    }
    
    const submissionData = {
      description: values.description,
      details: values.details,
      dueDate: values.dueDate ? values.dueDate.toISOString() : null,
      frequency: values.frequency as TaskFrequency,
      linkGroupId: values.linkType === 'group' ? values.linkGroupId : null,
      links: links,
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
                name="linkType"
                render={({ field }) => (
                    <FormItem className="space-y-3">
                    <FormLabel>Links</FormLabel>
                    <FormControl>
                        <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex items-center space-x-4 flex-wrap"
                        >
                            <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl><RadioGroupItem value="none" /></FormControl>
                                <FormLabel className="font-normal">None</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl><RadioGroupItem value="group" /></FormControl>
                                <FormLabel className="font-normal">Link Group</FormLabel>
                            </FormItem>
                            <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl><RadioGroupItem value="manual" /></FormControl>
                                <FormLabel className="font-normal">Manual Links</FormLabel>
                            </FormItem>
                             <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl><RadioGroupItem value="internal" /></FormControl>
                                <FormLabel className="font-normal">Internal Page</FormLabel>
                            </FormItem>
                        </RadioGroup>
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
             />

            {linkType === 'group' && (
              <FormField
                control={form.control}
                name="linkGroupId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link Group</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''} disabled={isLoadingLinkGroups}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a link group" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
            )}
            
            {linkType === 'manual' && (
              <div className="space-y-2">
                <FormLabel>Manual Links</FormLabel>
                {fields.map((field, index) => (
                   <FormField
                        key={field.id}
                        control={form.control}
                        name={`links.${index}.value`}
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center gap-2">
                                    <FormControl>
                                        <Input {...field} placeholder="https://example.com" />
                                    </FormControl>
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                ))}
                 <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => append({ value: '' })}
                >
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Link
                </Button>
              </div>
            )}

            {linkType === 'internal' && (
                <FormField
                    control={form.control}
                    name="internalLink"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Internal Page</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a page" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {internalPages.map(page => (
                                        <SelectItem key={page.value} value={page.value}>
                                            {page.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            )}


            <DialogFooter>
              <Button type="submit">{editingTask ? 'Save Changes' : 'Add Task'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
