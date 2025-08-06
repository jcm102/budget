'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTasks } from '@/hooks/use-tasks';
import { TaskForm } from '@/components/task-form';
import { TaskList } from '@/components/task-list';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Sunrise, CalendarDays, CalendarRange, ArrowRight, Lightbulb, Banknote, Settings, CreditCard, PiggyBank } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { Task, Subtask } from '@/types';

export default function Home() {
  const { 
    tasks, 
    addTask, 
    updateTask, 
    toggleTask, 
    deleteTask, 
    isLoading,
    updateTaskOrder,
    addSubtask,
    updateSubtask,
    updateSubtaskOrder,
    toggleSubtask,
    deleteSubtask,
  } = useTasks();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleFormOpenChange = (isOpen: boolean) => {
    setIsFormOpen(isOpen);
    if (!isOpen) {
      setEditingTask(null);
    }
  }

  const dailyTasks = tasks.filter((t) => t.frequency === 'daily');
  const weeklyTasks = tasks.filter((t) => t.frequency === 'weekly');
  const monthlyTasks = tasks.filter((t) => t.frequency === 'monthly');

  const handleUpdateTaskOrder = (reorderedTasks: Task[], frequency: Task['frequency']) => {
    const otherTasks = tasks.filter(t => t.frequency !== frequency);
    const updatedTasks = [...otherTasks, ...reorderedTasks].map((task, index) => ({...task, order: index}));
    updateTaskOrder(updatedTasks);
  }

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
      <TaskForm
        open={isFormOpen}
        onOpenChange={handleFormOpenChange}
        addTask={addTask}
        updateTask={updateTask}
        editingTask={editingTask}
      />
      <div className="container mx-auto max-w-4xl p-4 md:p-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold font-headline text-primary">TaskTrack Budget</h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Your personal assistant for daily, weekly, and monthly budgeting tasks.
          </p>
          <div className="mt-4 flex justify-center items-center gap-4 flex-wrap">
             <Button asChild variant="outline" size="lg">
                <Link href="/debt">
                  Debt Payment Worksheet <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
             </Button>
             <Button asChild variant="outline" size="lg">
                <Link href="/budget">
                  Budget Overview <Banknote className="ml-2 h-5 w-5" />
                </Link>
             </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/expenses">
                  Work Expense Tracking <CreditCard className="ml-2 h-5 w-5" />
                </Link>
              </Button>
               <Button asChild variant="outline" size="lg">
                <Link href="/savings">
                  Future Spending <PiggyBank className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/settings">
                  Settings <Settings className="ml-2 h-5 w-5" />
                </Link>
             </Button>
             <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="lg">
                    <Lightbulb className="mr-2 h-5 w-5" />
                    Splitwise Tip
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <h4 className="font-medium leading-none">Entering Splitwise Transactions</h4>
                  <div className="text-sm text-muted-foreground mt-2 space-y-2">
                    <div>
                      <h5 className="font-semibold">Jordan Paid:</h5>
                      <p>1. Enter split transaction in Actual</p>
                      <p>2. First half into appropriate category. Transfer second half to splitwise account.</p>
                    </div>
                    <div>
                      <h5 className="font-semibold">Eric Paid:</h5>
                      <p>1. Enter my portion of the transaction into splitwise account. Categorize appropriately.</p>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
          </div>
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
                  onEdit={handleEdit}
                  onUpdateTaskOrder={(reorderedTasks) => handleUpdateTaskOrder(reorderedTasks, 'daily')}
                  onAddSubtask={addSubtask}
                  onUpdateSubtask={updateSubtask}
                  onToggleSubtask={toggleSubtask}
                  onDeleteSubtask={deleteSubtask}
                  onUpdateSubtaskOrder={updateSubtaskOrder}
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
                  onEdit={handleEdit}
                  onUpdateTaskOrder={(reorderedTasks) => handleUpdateTaskOrder(reorderedTasks, 'weekly')}
                  onAddSubtask={addSubtask}
                  onUpdateSubtask={updateSubtask}
                  onToggleSubtask={toggleSubtask}
                  onDeleteSubtask={deleteSubtask}
                  onUpdateSubtaskOrder={updateSubtaskOrder}
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
                  onEdit={handleEdit}
                  onUpdateTaskOrder={(reorderedTasks) => handleUpdateTaskOrder(reorderedTasks, 'monthly')}
                  onAddSubtask={addSubtask}
                  onUpdateSubtask={updateSubtask}
                  onToggleSubtask={toggleSubtask}
                  onDeleteSubtask={deleteSubtask}
                  onUpdateSubtaskOrder={updateSubtaskOrder}
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
