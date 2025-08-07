
'use client';

import type { ReactNode } from 'react';
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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import type { Task, Subtask, LinkGroup } from '@/types';
import { TaskItem } from '@/components/task-item';

type TaskListProps = {
  title: string;
  tasks: Task[];
  linkGroups: LinkGroup[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  icon: ReactNode;
  onUpdateTaskOrder: (reorderedTasks: Task[]) => void;
  onAddSubtask: (taskId: string, data: any) => void;
  onUpdateSubtask: (taskId: string, subtaskId: string, data: any) => void;
  onUpdateSubtaskOrder: (taskId: string, reorderedSubtasks: Subtask[]) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onDeleteSubtask: (taskId: string, subtaskId: string) => void;
};

export function TaskList({ 
  title, 
  tasks,
  linkGroups,
  onToggle, 
  onDelete, 
  onEdit, 
  icon,
  onUpdateTaskOrder,
  onAddSubtask,
  onUpdateSubtask,
  onUpdateSubtaskOrder,
  onToggleSubtask,
  onDeleteSubtask
}: TaskListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = tasks.findIndex((task) => task.id === active.id);
      const newIndex = tasks.findIndex((task) => task.id === over!.id);
      const reorderedTasks = arrayMove(tasks, oldIndex, newIndex);
      onUpdateTaskOrder(reorderedTasks);
    }
  };
  
  const sortedTasks = [...tasks].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold font-headline tracking-tight">{title}</h2>
      {tasks.length > 0 ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {sortedTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  linkGroups={linkGroups}
                  onToggle={onToggle}
                  onDelete={onDelete}
                  onEdit={onEdit}
                  onAddSubtask={onAddSubtask}
                  onUpdateSubtask={onUpdateSubtask}
                  onToggleSubtask={onToggleSubtask}
                  onDeleteSubtask={onDeleteSubtask}
                  onUpdateSubtaskOrder={onUpdateSubtaskOrder}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
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
