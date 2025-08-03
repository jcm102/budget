'use client';

import { useState } from 'react';
import { useTasks } from '@/hooks/use-tasks';
import { TaskForm } from '@/components/task-form';
import { TaskList } from '@/components/task-list';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Sunrise, CalendarDays, CalendarRange } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  const { tasks, addTask, toggleTask, deleteTask, isLoading } = useTasks();
  const [isFormOpen, setIsFormOpen] = useState(false);

  const dailyTasks = tasks.filter((t) => t.frequency === 'daily');
  const weeklyTasks = tasks.filter((t) => t.frequency === 'weekly');
  const monthlyTasks = tasks.filter((t) => t.frequency === 'monthly');

  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );

  return (
    <>
      <TaskForm open={isFormOpen} onOpenChange={setIsFormOpen} addTask={addTask} />
      <div className="container mx-auto max-w-4xl p-4 md:p-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary">TaskTrack Budget</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Your personal assistant for daily, weekly, and monthly budgeting tasks.
          </p>
        </header>

        <main>
          <div className="flex justify-center mb-6">
            <Button size="lg" onClick={() => setIsFormOpen(true)}>
              <PlusCircle className="mr-2 h-5 w-5" />
              Add New Task
            </Button>
          </div>

          <Tabs defaultValue="daily" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-secondary/50">
              <TabsTrigger value="daily"><Sunrise className="mr-2 h-4 w-4" />Daily</TabsTrigger>
              <TabsTrigger value="weekly"><CalendarDays className="mr-2 h-4 w-4" />Weekly</TabsTrigger>
              <TabsTrigger value="monthly"><CalendarRange className="mr-2 h-4 w-4" />Monthly</TabsTrigger>
            </TabsList>
            <TabsContent value="daily" className="mt-6">
              {isLoading ? renderLoadingSkeleton() : (
                <TaskList
                  title="Daily Tasks"
                  tasks={dailyTasks}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                  icon={<Sunrise className="h-8 w-8 text-primary/80" />}
                />
              )}
            </TabsContent>
            <TabsContent value="weekly" className="mt-6">
               {isLoading ? renderLoadingSkeleton() : (
                <TaskList
                  title="Weekly Tasks"
                  tasks={weeklyTasks}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                  icon={<CalendarDays className="h-8 w-8 text-primary/80" />}
                />
              )}
            </TabsContent>
            <TabsContent value="monthly" className="mt-6">
               {isLoading ? renderLoadingSkeleton() : (
                <TaskList
                  title="Monthly Tasks"
                  tasks={monthlyTasks}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                  icon={<CalendarRange className="h-8 w-8 text-primary/80" />}
                />
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </>
  );
}
