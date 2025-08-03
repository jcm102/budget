'use client';

import { format, isPast } from 'date-fns';
import { Trash2 } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Task } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
};

export function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !task.completed;

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
      <CardContent className="p-4 flex items-center gap-4">
        <Checkbox
          id={`task-${task.id}`}
          checked={task.completed}
          onCheckedChange={() => onToggle(task.id)}
          aria-label={`Mark task ${task.description} as ${
            task.completed ? 'not completed' : 'completed'
          }`}
          className="h-6 w-6 rounded-md"
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
          {task.dueDate && (
            <p className="text-sm text-muted-foreground">
              Due: {format(new Date(task.dueDate), 'PPP')}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
            {isOverdue && !task.completed && <Badge variant="destructive">Overdue</Badge>}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete task</span>
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this task.
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
      </CardContent>
    </Card>
  );
}
