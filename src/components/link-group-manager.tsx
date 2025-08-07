'use client';

import { useState } from 'react';
import { useLinkGroups } from '@/hooks/use-link-groups';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Trash2, PlusCircle, Link as LinkIcon, Pencil } from 'lucide-react';
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
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
  } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { buttonVariants } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { useFieldArray, useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { LinkGroup } from '@/types';

const formSchema = z.object({
  name: z.string().min(2, 'Group name must be at least 2 characters.'),
  links: z.array(z.object({ value: z.string().url({ message: "Please enter a valid URL." }) })),
});


function LinkGroupForm({ group, onSave, onOpenChange }: { group: LinkGroup | null, onSave: (data: z.infer<typeof formSchema>) => void, onOpenChange: (open: boolean) => void }) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: group?.name || '',
            links: group?.links.map(link => ({ value: link })) || [{ value: '' }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'links'
    });

    const onSubmit = (data: z.infer<typeof formSchema>) => {
        onSave(data);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Group Name</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Credit Cards" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div>
                    <FormLabel>Links</FormLabel>
                    <div className="space-y-2 mt-2">
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
                    </div>
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

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button type="submit">Save</Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

export function LinkGroupManager() {
  const { linkGroups, addLinkGroup, updateLinkGroup, deleteLinkGroup, isLoading } = useLinkGroups();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<LinkGroup | null>(null);

  const handleSave = (data: z.infer<typeof formSchema>) => {
    const linkValues = data.links.map(l => l.value).filter(Boolean);
    if (editingGroup) {
        updateLinkGroup(editingGroup.id, data.name, linkValues);
    } else {
        addLinkGroup(data.name, linkValues);
    }
    setIsFormOpen(false);
    setEditingGroup(null);
  };
  
  const handleEditClick = (group: LinkGroup) => {
    setEditingGroup(group);
    setIsFormOpen(true);
  }
  
  const handleAddNewClick = () => {
    setEditingGroup(null);
    setIsFormOpen(true);
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
        setEditingGroup(null);
    }
    setIsFormOpen(open);
  }

  const renderLoadingSkeleton = () => (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
                <CardTitle>Link Groups</CardTitle>
                <CardDescription>
                    Manage groups of links that can be shared across multiple tasks.
                </CardDescription>
            </div>
            <Dialog open={isFormOpen} onOpenChange={handleOpenChange}>
                <DialogTrigger asChild>
                    <Button onClick={handleAddNewClick}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Group
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingGroup ? 'Edit Link Group' : 'Create New Link Group'}</DialogTitle>
                    </DialogHeader>
                    <LinkGroupForm group={editingGroup} onSave={handleSave} onOpenChange={handleOpenChange} />
                </DialogContent>
            </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {isLoading ? (
            renderLoadingSkeleton()
          ) : linkGroups.length > 0 ? (
            linkGroups.map((group) => (
              <div
                key={group.id}
                className="flex items-center justify-between p-2 pl-4 border rounded-md"
              >
                <div>
                    <span className="font-medium">{group.name}</span>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <LinkIcon className="h-3 w-3" />
                        {group.links.length} link(s)
                    </div>
                </div>
                <div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditClick(group)}>
                      <Pencil className="h-4 w-4" />
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
                            This will permanently delete the &quot;{group.name}&quot; link group. Tasks using this group will no longer have these links.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteLinkGroup(group.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
                            Delete
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                    </AlertDialog>
                </div>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-center p-4">
              No link groups yet. Add one to get started.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
