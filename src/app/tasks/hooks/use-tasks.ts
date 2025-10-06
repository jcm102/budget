
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Task, Subtask, LinkGroup } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, writeBatch, addDoc, deleteDoc } from 'firebase/firestore';


export function useTasks() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const tasksQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'tasks'), orderBy('order'));
  }, [firestore]);

  const linkGroupsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'link-groups'), orderBy('name'));
  }, [firestore]);

  const { data: tasksData, isLoading: isLoadingTasks, error: tasksError } = useCollection<Task>(tasksQuery);
  const { data: linkGroupsData, isLoading: isLoadingLinkGroups, error: linkGroupsError } = useCollection<LinkGroup>(linkGroupsQuery);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [linkGroups, setLinkGroups] = useState<LinkGroup[]>([]);
  
  const isLoading = isLoadingTasks || isLoadingLinkGroups;

  const fetchData = useCallback(async () => {
    // This function is now mostly handled by the useCollection hooks.
    // We can keep it for any potential manual refetch logic in the future.
  }, []);

  useEffect(() => {
    if (tasksData) {
      setTasks(tasksData);
    }
  }, [tasksData]);
  
  useEffect(() => {
    if (linkGroupsData) {
      setLinkGroups(linkGroupsData);
    }
  }, [linkGroupsData]);
  
  const addTask = useCallback(async (taskData: Omit<Task, 'id' | 'completed' | 'completedAt' | 'subtasks' | 'order'>) => {
    if (!firestore) return;
    try {
      const newOrder = tasks.filter(t => t.frequency === taskData.frequency).length;
      const newTask: Omit<Task, 'id'> = {
        ...taskData,
        completed: false,
        completedAt: null,
        subtasks: [],
        order,
        linkGroupId: taskData.linkGroupId || null,
        links: taskData.links || [],
        internalLink: taskData.internalLink || null,
      };
      await addDoc(collection(firestore, 'tasks'), newTask);
      // No need to set state, useCollection will update
    } catch (error) {
      console.error('Failed to add task:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new task.',
        variant: 'destructive',
      });
    }
  }, [firestore, tasks, toast]);

  const updateTask = useCallback(async (id: string, taskData: Partial<Omit<Task, 'id'>>) => {
     if (!firestore) return;
    try {
      const taskRef = doc(firestore, 'tasks', id);
      await updateDoc(taskRef, taskData);
    } catch (error) {
      console.error('Failed to update task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the task.',
        variant: 'destructive',
      });
    }
  }, [firestore, toast]);

  const updateTaskOrder = useCallback(async (reorderedTasks: Task[]) => {
    if (!firestore) return;
    setTasks(reorderedTasks); // Optimistic update
    try {
      const batch = writeBatch(firestore);
      reorderedTasks.forEach((task, index) => {
        const taskRef = doc(firestore, 'tasks', task.id);
        batch.update(taskRef, { order: index });
      });
      await batch.commit();
    } catch (error) {
      console.error('Failed to update task order:', error);
      // Revert on error would require fetching data again, useCollection handles this.
      toast({
        title: 'Error',
        description: 'Failed to save the new task order.',
        variant: 'destructive',
      });
    }
  }, [firestore, toast]);

  const toggleTask = useCallback(async (id: string) => {
    if (!firestore) return;
    const taskToToggle = tasks.find((t) => t.id === id);
    if (!taskToToggle) return;

    const newCompleted = !taskToToggle.completed;
    const newCompletedAt = newCompleted ? new Date().toISOString() : null;
    const updatedSubtasks = (taskToToggle.subtasks || []).map(st => ({...st, completed: newCompleted}));

    try {
      const taskRef = doc(firestore, 'tasks', id);
      await updateDoc(taskRef, { completed: newCompleted, completedAt: newCompletedAt, subtasks: updatedSubtasks });
    } catch (error) {
      console.error('Failed to toggle task:', error);
       toast({
        title: 'Error',
        description: 'Failed to update the task status.',
        variant: 'destructive',
      });
    }
  }, [firestore, tasks, toast]);

  const deleteTask = useCallback(async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'tasks', id));
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the task.',
        variant: 'destructive',
      });
    }
  }, [firestore, toast]);

  const addSubtask = useCallback(async (taskId: string, data: Omit<Subtask, 'id' | 'completed' | 'order'>) => {
    if (!firestore) return;
    const taskRef = doc(firestore, 'tasks', taskId);
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;
    
    const newOrder = taskToUpdate.subtasks ? taskToUpdate.subtasks.length : 0;
    const newSubtask: Subtask = {
      id: crypto.randomUUID(),
      description: data.description,
      completed: false,
      order: newOrder,
      links: data.links || [],
      linkGroupId: data.linkGroupId || null,
      internalLink: data.internalLink || null,
    };
    const updatedSubtasks = [...(taskToUpdate.subtasks || []), newSubtask];
    try {
      await updateDoc(taskRef, { subtasks: updatedSubtasks, completed: false, completedAt: null });
    } catch (error) {
       console.error('Failed to add subtask:', error);
       toast({ title: 'Error', description: 'Failed to add subtask.', variant: 'destructive' });
    }
  }, [firestore, tasks, toast]);
  
  const updateSubtask = useCallback(async (taskId: string, subtaskId: string, data: Partial<Omit<Subtask, 'id' | 'completed' | 'order'>>) => {
    if (!firestore) return;
    const taskRef = doc(firestore, 'tasks', taskId);
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    const updatedSubtasks = (taskToUpdate.subtasks || []).map(subtask => 
      subtask.id === subtaskId ? { ...subtask, ...data } : subtask
    );
     try {
      await updateDoc(taskRef, { subtasks: updatedSubtasks });
    } catch (error) {
       console.error('Failed to update subtask:', error);
       toast({ title: 'Error', description: 'Failed to update subtask.', variant: 'destructive' });
    }
  }, [firestore, tasks, toast]);

  const updateSubtaskOrder = useCallback(async (taskId: string, subtasks: Subtask[]) => {
    if (!firestore) return;
    const taskRef = doc(firestore, 'tasks', taskId);
    const updatedSubtasks = subtasks.map((subtask, index) => ({...subtask, order: index}));
    try {
      await updateDoc(taskRef, { subtasks: updatedSubtasks });
    } catch (error) {
       console.error('Failed to update subtask order:', error);
       toast({ title: 'Error', description: 'Failed to save subtask order.', variant: 'destructive' });
    }
  }, [firestore, toast]);

  const toggleSubtask = useCallback(async (taskId: string, subtaskId: string) => {
    if (!firestore) return;
    const taskRef = doc(firestore, 'tasks', taskId);
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    const updatedSubtasks = (taskToUpdate.subtasks || []).map(st => 
        st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );

    const allSubtasksCompleted = updatedSubtasks.every(st => st.completed);

    const updatedTaskData = {
        subtasks: updatedSubtasks,
        completed: allSubtasksCompleted,
        completedAt: allSubtasksCompleted ? new Date().toISOString() : null,
    };
    try {
      await updateDoc(taskRef, updatedTaskData);
    } catch (error) {
       console.error('Failed to toggle subtask:', error);
       toast({ title: 'Error', description: 'Failed to toggle subtask status.', variant: 'destructive' });
    }
  }, [firestore, tasks, toast]);

  const deleteSubtask = useCallback(async (taskId: string, subtaskId: string) => {
    if (!firestore) return;
    const taskRef = doc(firestore, 'tasks', taskId);
    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    const updatedSubtasks = (taskToUpdate.subtasks || []).filter(st => st.id !== subtaskId);
    const allSubtasksCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every(st => st.completed);

    const updatedTaskData = {
        subtasks: updatedSubtasks,
        completed: allSubtasksCompleted,
        completedAt: allSubtasksCompleted ? new Date().toISOString() : null,
    };
     try {
      await updateDoc(taskRef, updatedTaskData);
    } catch (error) {
       console.error('Failed to delete subtask:', error);
       toast({ title: 'Error', description: 'Failed to delete subtask.', variant: 'destructive' });
    }
  }, [firestore, tasks, toast]);


  return { tasks, linkGroups, addTask, updateTask, toggleTask, deleteTask, isLoading, updateTaskOrder, addSubtask, updateSubtask, updateSubtaskOrder, toggleSubtask, deleteSubtask, fetchData };
}
