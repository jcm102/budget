
'use client';

import React, { useState } from 'react';
import { format, isPast } from 'date-fns';
import { Trash2, Pencil, Plus, ChevronsUpDown, CheckCircle2, Circle, GripVertical, Link as LinkIcon, ExternalLink } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type SubtaskItemProps = {
  subtask: Subtask;
  onToggle: () => void;
  onDelete: () => void;
  onUpdate: (description: string, link?: string) => void;
}

function SubtaskItem({ subtask, onToggle, onDelete, onUpdate }: SubtaskItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(subtask.description);
  const [link, setLink] = useState(subtask.link || '');
  
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

  const handleUpdate = () => {
    if (description.trim()) {
      onUpdate(description.trim(), link.trim() || undefined);
      setIsEditing(false);
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col gap-1">
      <div className="flex items-center gap-2 group/subtask">
        <Button variant="ghost" size="icon" className="h-6 w-6 cursor-grab" {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Checkbox
            id={`subtask-${subtask.id}`}
            checked={subtask.completed}
            onCheckedChange={onToggle}
            className="h-5 w-5"
        />
        {isEditing ? (
            <Input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleUpdate}
            onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
            className="h-8"
            autoFocus
            />
        ) : (
            <label
            htmlFor={`subtask-${subtask.id}`}
            className={cn("flex-grow text-sm cursor-pointer", subtask.completed && 'line-through text-muted-foreground')}
            >
            {subtask.description}
            </label>
        )}
         {subtask.link && !isEditing && (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <a href={subtask.link} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-6 w-6")}>
                            <ExternalLink className="h-3 w-3" />
                         </a>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{subtask.link}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )}
        <div className="flex items-center gap-1 opacity-0 group-hover/subtask:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsEditing(true)}>
            <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
            </Button>
        </div>
      </div>
      {isEditing && (
         <div className="flex items-center gap-2 pl-8">
            <LinkIcon className="h-3 w-3 text-muted-foreground" />
            <Input
                type="text"
                value={link}
                placeholder="https://..."
                onChange={(e) => setLink(e.target.value)}
                onBlur={handleUpdate}
                onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                className="h-7 text-xs"
            />
        </div>
      )}
    </div>
  )
}

type TaskItemProps = {
  task: Task;
  linkGroups: LinkGroup[];
  onToggle: (id: string) => void;
  onDelete: (id:string) => void;
  onEdit: (task: Task) => void;
  onAddSubtask: (taskId: string, description: string, link?: string) => void;
  onUpdateSubtask: (taskId: string, subtaskId: string, description: string, link?: string) => void;
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
  const [newSubtask, setNewSubtask] = useState('');
  const [newSubtaskLink, setNewSubtaskLink] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);
  
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
  const hasLinks = associatedLinkGroup && associatedLinkGroup.links.length > 0;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubtask.trim()) {
      onAddSubtask(task.id, newSubtask.trim(), newSubtaskLink.trim() || undefined);
      setNewSubtask('');
      setNewSubtaskLink('');
      setShowLinkInput(false);
    }
  };

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
    if (associatedLinkGroup?.links) {
      associatedLinkGroup.links.forEach(link => {
        window.open(link, '_blank', 'noopener,noreferrer');
      });
    }
  };


  return (
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
                                    onToggle={() => onToggleSubtask(task.id, subtask.id)}
                                    onDelete={() => onDeleteSubtask(task.id, subtask.id)}
                                    onUpdate={(desc, link) => onUpdateSubtask(task.id, subtask.id, desc, link)}
                                />
                            ))}
                        </SortableContext>
                    </DndContext>
                </CollapsibleContent>
            </div>
          )}

          <div className="pl-10 mt-2">
            <form onSubmit={handleAddSubtask}>
                <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-muted-foreground"/>
                    <Input
                        placeholder="Add a subtask..."
                        value={newSubtask}
                        onChange={(e) => setNewSubtask(e.target.value)}
                        className="h-8 border-none focus-visible:ring-0 focus-visible:ring-offset-0 !bg-transparent flex-grow"
                    />
                     <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowLinkInput(!showLinkInput)}>
                                    <LinkIcon className={cn("h-4 w-4", showLinkInput && "text-primary")} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Add link to subtask</TooltipContent>
                        </Tooltip>
                     </TooltipProvider>
                    {newSubtask && <Button type="submit" size="sm">Add</Button>}
                </div>
                {showLinkInput && (
                     <div className="flex items-center gap-2 pl-6 mt-1">
                        <Input
                            placeholder="https://..."
                            value={newSubtaskLink}
                            onChange={(e) => setNewSubtaskLink(e.target.value)}
                            className="h-7 border-none focus-visible:ring-0 focus-visible:ring-offset-0 !bg-transparent text-xs"
                        />
                    </div>
                )}
            </form>
          </div>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
