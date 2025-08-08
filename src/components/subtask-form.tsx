
'use client';

import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
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
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useLinkGroups } from '@/hooks/use-link-groups';
import { PlusCircle, Trash2 } from 'lucide-react';
import { internalPages } from '@/types';

const linkSchema = z.object({ value: z.string() }).transform(data => {
    return data.value.trim() === '' ? undefined : data;
}).pipe(z.object({ value: z.string().url({ message: "Please enter a valid URL." }) }).optional());


const formSchema = z.object({
  description: z.string().min(2, 'Description must be at least 2 characters.'),
  linkType: z.enum(['none', 'group', 'manual', 'internal']).default('none'),
  linkGroupId: z.string().optional(),
  links: z.array(linkSchema).optional(),
  internalLink: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.linkType === 'group' && !data.linkGroupId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please select a link group.",
            path: ['linkGroupId'],
        });
    }
    if (data.linkType === 'manual') {
        const hasManualLink = data.links?.some(l => l && l.value.trim() !== '');
        if (!hasManualLink) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Please enter at least one valid URL.",
                path: ['links'],
            });
        }
    }
    if (data.linkType === 'internal' && !data.internalLink) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please select an internal page.",
            path: ['internalLink'],
        });
    }
});


type SubtaskFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: z.infer<typeof formSchema>) => void;
  editingSubtask: Subtask | null;
};

export function SubtaskForm({ open, onOpenChange, onSave, editingSubtask }: SubtaskFormProps) {
  const { linkGroups, isLoading: isLoadingLinkGroups } = useLinkGroups();
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: '',
      linkType: 'none',
      linkGroupId: '',
      links: [{ value: '' }],
      internalLink: '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'links'
  });

  const linkType = form.watch('linkType');

  useEffect(() => {
    if (open) {
      if (editingSubtask) {
        let type: 'group' | 'manual' | 'none' | 'internal' = 'none';

        if (editingSubtask.linkGroupId) {
            type = 'group';
        } else if (editingSubtask.internalLink) {
            type = 'internal';
        } else if (editingSubtask.links && editingSubtask.links.length > 0) {
            type = 'manual';
        }
        form.reset({
          description: editingSubtask.description,
          linkType: type,
          linkGroupId: editingSubtask.linkGroupId || '',
          links: editingSubtask.links && editingSubtask.links.length > 0 ? editingSubtask.links.map(l => ({value: l})) : [{ value: '' }],
          internalLink: editingSubtask.internalLink || '',
        });
      } else {
        form.reset({
          description: '',
          linkType: 'none',
          linkGroupId: '',
          links: [{ value: '' }],
          internalLink: '',
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
              name="linkType"
              render={({ field }) => (
                  <FormItem className="space-y-3">
                  <FormLabel>Links</FormLabel>
                  <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="grid grid-cols-2 gap-x-4 gap-y-2"
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
                        name={`links.${index}`}
                        render={({ field: fieldProps }) => (
                            <FormItem>
                                <div className="flex items-center gap-2">
                                    <FormControl>
                                       <Input {...fieldProps} value={fieldProps.value?.value ?? ''} onChange={(e) => fieldProps.onChange({value: e.target.value})} placeholder="https://example.com" />
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
                          <SelectValue placeholder="Select a page to link to" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {internalPages.map(page => (
                          <SelectItem key={page.path} value={page.path}>
                            {page.name}
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
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit">{editingSubtask ? 'Save Changes' : 'Add Subtask'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
