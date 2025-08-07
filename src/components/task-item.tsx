
'use client';

import React, { useState } from 'react';
import { format, isPast } from 'date-fns';
import { Trash2, Pencil, Plus, ChevronsUpDown, CheckCircle2, Circle, GripVertical, Link as LinkIcon } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';


import { cn } from '@/lib/utils';
import type { Task, Subtask, LinkGroup } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
import { buttonVariants } from './ui/button';
import { SubtaskForm } from './subtask-form';

type SubtaskItemProps = {
  subtask: Subtask;
  linkGroups: LinkGroup[];
  onToggle: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

function SubtaskItem({ subtask, linkGroups, onToggle, onDelete, onEdit }: SubtaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({id: subtask.id});

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  
  const associatedLinkGroup = linkGroups.find(lg => lg.id === subtask.linkGroupId);
  const hasLinks = (associatedLinkGroup && associatedLinkGroup.links.length > 0) || (subtask.links && subtask.links.length > 0);
  
  const handleOpenLinks = () => {
    const linksToOpen = subtask.linkGroupId 
      ? associatedLinkGroup?.links 
      : subtask.links;

    if (linksToOpen) {
      linksToOpen.forEach(link => {
        window.open(link, '_blank', 'noopener,noreferrer');
      });
    }
  };


  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 group/subtask">
        <Button variant="ghost" size="icon" className="h-6 w-6 cursor-grab" {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Checkbox
            id={`subtask-${subtask.id}`}
            checked={subtask.completed}
            onCheckedChange={onToggle}
            className="h-5 w-5"
        />
        <label
            htmlFor={`subtask-${subtask.id}`}
            className={cn("flex-grow text-sm cursor-pointer", subtask.completed && 'line-through text-muted-foreground')}
            >
            {subtask.description}
        </label>
        <div className="flex items-center gap-1 opacity-0 group-hover/subtask:opacity-100 transition-opacity">
            {hasLinks && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleOpenLinks}>
                    <LinkIcon className="h-3 w-3" />
                </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onEdit}>
                <Pencil className="h-3 w-3" />
            </Button>
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </AlertDialogTrigger>
                 <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete this subtask.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={onDelete} className={cn(buttonVariants({ variant: "destructive" }))}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
            </AlertDialog>
        </div>
    </div>
  )
}

type TaskItemProps = {
  task: Task;
  linkGroups: LinkGroup[];
  onToggle: (id: string) => void;
  onDelete: (id:string) => void;
  onEdit: (task: Task) => void;
  onAddSubtask: (taskId: string, data: any) => void;
  onUpdateSubtask: (taskId: string, subtaskId: string, data: any) => void;
  onUpdateSubtaskOrder: (taskId: string, reorderedSubtasks: Subtask[]) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
};

export function TaskItem({
  task,
  linkGroups,
  onToggle,
  onDelete,
  onEdit,
  onAddSubtask,
  onUpdateSubtask,
  onUpdateSubtaskOrder,
  onToggleSubtask,
  onDeleteSubtask
}: TaskItemProps) {
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(false);
  const [isSubtaskFormOpen, setIsSubtaskFormOpen] = useState(false);
  const [editingSubtask, setEditingSubtask] = useState<Subtask | null>(null);
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !task.completed;
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const completedSubtasks = task.subtasks?.filter(st => st.completed).length || 0;
  const sortedSubtasks = (task.subtasks || []).slice().sort((a,b) => a.order - b.order);

  const associatedLinkGroup = linkGroups.find(lg => lg.id === task.linkGroupId);
  const hasLinks = (associatedLinkGroup && associatedLinkGroup.links.length > 0) || (task.links && task.links.length > 0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );
  
  const handleOpenSubtaskForm = (subtask: Subtask | null) => {
    setEditingSubtask(subtask);
    setIsSubtaskFormOpen(true);
  }

  const handleSaveSubtask = (data: any) => {
    const submissionData = {
      description: data.description,
      linkGroupId: data.linkType === 'group' ? data.linkGroupId : null,
      links: data.linkType === 'manual' ? data.links?.map((l:any) => l.value).filter(Boolean) : [],
    };

    if (editingSubtask) {
        onUpdateSubtask(task.id, editingSubtask.id, submissionData);
    } else {
        onAddSubtask(task.id, submissionData);
    }
    setEditingSubtask(null);
  }


  const handleSubtaskDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
        const oldIndex = sortedSubtasks.findIndex(st => st.id === active.id);
        const newIndex = sortedSubtasks.findIndex(st => st.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
            const reordered = arrayMove(sortedSubtasks, oldIndex, newIndex);
            onUpdateSubtaskOrder(task.id, reordered);
        }
    }
  };
  
  const handleOpenLinks = () => {
    const linksToOpen = task.linkGroupId 
      ? associatedLinkGroup?.links 
      : task.links;

    if (linksToOpen) {
      linksToOpen.forEach(link => {
        window.open(link, '_blank', 'noopener,noreferrer');
      });
    }
  };


  return (
    <>
    <SubtaskForm
        open={isSubtaskFormOpen}
        onOpenChange={setIsSubtaskFormOpen}
        onSave={handleSaveSubtask}
        editingSubtask={editingSubtask}
    />
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-all duration-300 ease-in-out group',
        task.completed
          ? 'bg-accent/20 border-accent/50 opacity-70'
          : 'bg-card',
        isOverdue && !task.completed ? 'border-destructive/80 shadow-sm shadow-destructive/20' : ''
      )}
    >
      <Collapsible open={isCollapsibleOpen} onOpenChange={setIsCollapsibleOpen}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex items-center gap-2 pt-1">
               <Button variant="ghost" size="icon" className="h-6 w-6 cursor-grab" {...attributes} {...listeners}>
                <GripVertical className="h-4 w-4 text-muted-foreground" />
               </Button>
                <Checkbox
                id={`task-${task.id}`}
                checked={task.completed}
                onCheckedChange={() => onToggle(task.id)}
                aria-label={`Mark task ${task.description} as ${
                    task.completed ? 'not completed' : 'completed'
                }`}
                className="h-6 w-6 rounded-md"
                />
            </div>
            <div className="flex-grow space-y-1">
              <label
                htmlFor={`task-${task.id}`}
                className={cn(
                  'font-medium cursor-pointer',
                  task.completed && 'line-through text-muted-foreground'
                )}
              >
                {task.description}
              </label>
              {task.details && (
                <p className="text-sm text-muted-foreground">{task.details}</p>
              )}
              {task.dueDate && (
                <p className="text-sm text-muted-foreground">
                  Due: {format(new Date(task.dueDate), 'PPP')}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                {isOverdue && !task.completed && (<Badge variant="destructive">Overdue</Badge>)}
                {hasLinks && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                    onClick={handleOpenLinks}
                  >
                    <LinkIcon className="h-4 w-4" />
                    <span className="sr-only">Open link(s)</span>
                  </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                    onClick={() => onEdit(task)}
                >
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit task</span>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete task</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete this task and all its subtasks.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(task.id)} className={cn(buttonVariants({ variant: "destructive" }))}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </div>
            {hasSubtasks && (
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <ChevronsUpDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
            )}
          </div>
          
          {hasSubtasks && (
            <div className='pl-10'>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2">
                  {task.completed ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Circle className="h-3 w-3 text-muted-foreground" />}
                  {completedSubtasks} of {task.subtasks?.length} completed
                </p>
                <CollapsibleContent className="space-y-3 mt-2">
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleSubtaskDragEnd}
                    >
                        <SortableContext items={sortedSubtasks.map(st => st.id)} strategy={verticalListSortingStrategy}>
                            {sortedSubtasks.map((subtask) => (
                                <SubtaskItem 
                                    key={subtask.id}
                                    subtask={subtask}
                                    linkGroups={linkGroups}
                                    onToggle={() => onToggleSubtask(task.id, subtask.id)}
                                    onDelete={() => onDeleteSubtask(task.id, subtask.id)}
                                    onEdit={() => handleOpenSubtaskForm(subtask)}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </CollapsibleContent>
            </div>
          )}

          <div className="pl-10 mt-2">
            <Button variant="link" className="p-0 h-auto font-normal text-muted-foreground" onClick={() => handleOpenSubtaskForm(null)}>
                <Plus className="h-4 w-4 mr-1"/>
                Add a subtask...
            </Button>
          </div>
        </CardContent>
      </Collapsible>
    </Card>
    </>
  );
}
