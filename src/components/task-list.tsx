'use client';

import type { ReactNode } from 'react';
import type { Task } from '@/types';
import { TaskItem } from '@/components/task-item';

type TaskListProps = {
  title: string;
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  icon: ReactNode;
};

export function TaskList({ title, tasks, onToggle, onDelete, icon }: TaskListProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold font-headline tracking-tight">{title}</h2>
      {tasks.length > 0 ? (
        <div className="space-y-3">
          {tasks
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
            .map((task) => (
              <TaskItem key={task.id} task={task} onToggle={onToggle} onDelete={onDelete} />
            ))}
        </div>
      ) : (
        <div className="text-center py-12 px-6 border-2 border-dashed rounded-lg">
          <div className="flex justify-center items-center mb-4">
            {icon}
          </div>
          <h3 className="text-xl font-medium text-muted-foreground">No tasks here yet!</h3>
          <p className="text-muted-foreground mt-1">
            Click &quot;Add New Task&quot; to get started.
          </p>
        </div>
      )}
    </div>
  );
}
