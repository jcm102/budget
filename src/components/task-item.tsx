'use client';

import React, { useState } from 'react';
import { format, isPast } from 'date-fns';
import { Trash2, Pencil, Plus, ChevronsUpDown, CheckCircle2, Circle } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Task, Subtask } from '@/types';
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

type TaskItemProps = {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id:string) => void;
  onEdit: (task: Task) => void;
  onAddSubtask: (taskId: string, description: string) => void;
  onUpdateSubtask: (taskId: string, subtaskId: string, description: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
};

export function TaskItem({
  task,
  onToggle,
  onDelete,
  onEdit,
  onAddSubtask,
  onUpdateSubtask,
  onToggleSubtask,
  onDeleteSubtask
}: TaskItemProps) {
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [editingSubtask, setEditingSubtask] = useState<{ id: string, description: string } | null>(null);

  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !task.completed;
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const completedSubtasks = task.subtasks?.filter(st => st.completed).length || 0;

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSubtask.trim()) {
      onAddSubtask(task.id, newSubtask.trim());
      setNewSubtask('');
    }
  };

  const handleUpdateSubtask = (subtaskId: string) => {
    if (editingSubtask && editingSubtask.description.trim()) {
      onUpdateSubtask(task.id, subtaskId, editingSubtask.description.trim());
      setEditingSubtask(null);
    }
  };

  return (
    <Card
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
            <Checkbox
              id={`task-${task.id}`}
              checked={task.completed}
              onCheckedChange={() => onToggle(task.id)}
              aria-label={`Mark task ${task.description} as ${
                task.completed ? 'not completed' : 'completed'
              }`}
              className="h-6 w-6 rounded-md mt-1"
            />
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
                <CollapsibleContent className="space-y-2 mt-2">
                  {task.subtasks?.map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-2 group/subtask">
                      <Checkbox
                        id={`subtask-${subtask.id}`}
                        checked={subtask.completed}
                        onCheckedChange={() => onToggleSubtask(task.id, subtask.id)}
                        className="h-5 w-5"
                      />
                      {editingSubtask?.id === subtask.id ? (
                        <Input
                          type="text"
                          value={editingSubtask.description}
                          onChange={(e) => setEditingSubtask({ ...editingSubtask, description: e.target.value })}
                          onBlur={() => handleUpdateSubtask(subtask.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleUpdateSubtask(subtask.id)}
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
                      <div className="flex items-center gap-1 opacity-0 group-hover/subtask:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingSubtask({id: subtask.id, description: subtask.description})}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 hover:text-destructive" onClick={() => onDeleteSubtask(task.id, subtask.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CollapsibleContent>
            </div>
          )}

          <div className="pl-10 mt-2">
            <form onSubmit={handleAddSubtask} className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-muted-foreground"/>
              <Input
                placeholder="Add a subtask..."
                value={newSubtask}
                onChange={(e) => setNewSubtask(e.target.value)}
                className="h-8 border-none focus-visible:ring-0 focus-visible:ring-offset-0 !bg-transparent"
              />
              {newSubtask && <Button type="submit" size="sm">Add</Button>}
            </form>
          </div>
        </CardContent>
      </Collapsible>
    </Card>
  );
}
