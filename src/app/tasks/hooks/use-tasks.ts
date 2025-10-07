
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Task, Subtask, LinkGroup } from '@/types';
import { useToast } from '@/hooks/use-toast';
import {
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';

export function useTasks() {
  const { toast } = useToast();
  const firestore = useFirestore();

  const tasksCollection = useMemoFirebase(
    () => collection(firestore, 'tasks'),
    [firestore]
  );
  const linkGroupsCollection = useMemoFirebase(
    () => collection(firestore, 'link-groups'),
    [firestore]
  );

  // Real-time data fetching with useCollection
  const { data: tasks, isLoading: isLoadingTasks } = useCollection<Task>(
    tasksCollection
  );
  const { data: linkGroups, isLoading: isLoadingLinkGroups } =
    useCollection<LinkGroup>(linkGroupsCollection);

  const isLoading = isLoadingTasks || isLoadingLinkGroups;

  const addTask = useCallback(
    async (
      taskData: Omit<
        Task,
        'id' | 'completed' | 'completedAt' | 'subtasks' | 'order'
      >
    ) => {
      if (!tasks || !tasksCollection) return;
      try {
        const newOrder =
          tasks.filter((t) => t.frequency === taskData.frequency).length || 0;
        const newTaskData = {
          ...taskData,
          completed: false,
          completedAt: null,
          subtasks: [],
          order: newOrder,
        };
        await addDocumentNonBlocking(
          tasksCollection,
          newTaskData
        );
      } catch (error) {
        console.error('Failed to add task:', error);
        toast({
          title: 'Error',
          description: 'Failed to add the new task.',
          variant: 'destructive',
        });
      }
    },
    [firestore, tasks, toast, tasksCollection]
  );

  const updateTask = useCallback(
    async (id: string, taskData: Partial<Omit<Task, 'id' | 'subtasks'>>) => {
      try {
        const taskRef = doc(firestore, 'tasks', id);
        await updateDocumentNonBlocking(taskRef, taskData);
      } catch (error) {
        console.error('Failed to update task:', error);
        toast({
          title: 'Error',
          description: 'Failed to update the task.',
          variant: 'destructive',
        });
      }
    },
    [firestore, toast]
  );

  const updateTaskOrder = useCallback(
    async (reorderedTasks: Task[]) => {
      try {
        const batch = writeBatch(firestore);
        reorderedTasks.forEach((task, index) => {
          const taskRef = doc(firestore, 'tasks', task.id);
          batch.update(taskRef, { order: index });
        });
        await batch.commit();
      } catch (error) {
        console.error('Failed to update task order:', error);
        toast({
          title: 'Error',
          description: 'Failed to save the new task order.',
          variant: 'destructive',
        });
      }
    },
    [firestore, toast]
  );

  const toggleTask = useCallback(
    async (id: string) => {
      if (!tasks) return;
      const taskToToggle = tasks.find((t) => t.id === id);
      if (!taskToToggle) return;

      const newCompleted = !taskToToggle.completed;
      const newCompletedAt = newCompleted ? new Date().toISOString() : null;
      const updatedSubtasks = (taskToToggle.subtasks || []).map((st) => ({
        ...st,
        completed: newCompleted,
      }));

      try {
        const taskRef = doc(firestore, 'tasks', id);
        await updateDocumentNonBlocking(taskRef, {
          completed: newCompleted,
          completedAt: newCompletedAt,
          subtasks: updatedSubtasks,
        });
      } catch (error) {
        console.error('Failed to toggle task:', error);
        toast({
          title: 'Error',
          description: 'Failed to update the task status.',
          variant: 'destructive',
        });
      }
    },
    [firestore, tasks, toast]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      try {
        const taskRef = doc(firestore, 'tasks', id);
        await deleteDocumentNonBlocking(taskRef);
      } catch (error) {
        console.error('Failed to delete task:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete the task.',
          variant: 'destructive',
        });
      }
    },
    [firestore, toast]
  );

  const addSubtask = useCallback(
    async (
      taskId: string,
      data: Omit<Subtask, 'id' | 'completed' | 'order'>
    ) => {
      if (!tasks) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      try {
        const newOrder = task.subtasks ? task.subtasks.length : 0;
        const newSubtask: Subtask = {
          id: crypto.randomUUID(),
          description: data.description,
          completed: false,
          order: newOrder,
          links: data.links || [],
          linkGroupId: data.linkGroupId || null,
          internalLink: data.internalLink || null,
        };
        const updatedSubtasks = [...(task.subtasks || []), newSubtask];
        const taskRef = doc(firestore, 'tasks', taskId);
        await updateDocumentNonBlocking(taskRef, {
          subtasks: updatedSubtasks,
          completed: false,
          completedAt: null,
        });
      } catch (error) {
        console.error('Failed to add subtask:', error);
        toast({
          title: 'Error',
          description: 'Failed to add subtask.',
          variant: 'destructive',
        });
      }
    },
    [firestore, tasks, toast]
  );

  const updateSubtask = useCallback(
    async (
      taskId: string,
      subtaskId: string,
      data: Partial<Omit<Subtask, 'id' | 'completed' | 'order'>>
    ) => {
      if (!tasks) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      try {
        const updatedSubtasks = (task.subtasks || []).map((subtask) =>
          subtask.id === subtaskId ? { ...subtask, ...data } : subtask
        );
        const taskRef = doc(firestore, 'tasks', taskId);
        await updateDocumentNonBlocking(taskRef, { subtasks: updatedSubtasks });
      } catch (error) {
        console.error('Failed to update subtask:', error);
        toast({
          title: 'Error',
          description: 'Failed to update subtask.',
          variant: 'destructive',
        });
      }
    },
    [firestore, tasks, toast]
  );

  const updateSubtaskOrder = useCallback(
    async (taskId: string, reorderedSubtasks: Subtask[]) => {
      try {
        const taskRef = doc(firestore, 'tasks', taskId);
        const updatedSubtasks = reorderedSubtasks.map((subtask, index) => ({
          ...subtask,
          order: index,
        }));
        await updateDocumentNonBlocking(taskRef, {
          subtasks: updatedSubtasks,
        });
      } catch (error) {
        console.error('Failed to update subtask order:', error);
        toast({
          title: 'Error',
          description: 'Failed to save subtask order.',
          variant: 'destructive',
        });
      }
    },
    [firestore, toast]
  );

  const toggleSubtask = useCallback(
    async (taskId: string, subtaskId: string) => {
      if (!tasks) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      try {
        const updatedSubtasks = (task.subtasks || []).map((st) =>
          st.id === subtaskId ? { ...st, completed: !st.completed } : st
        );

        const allSubtasksCompleted = updatedSubtasks.every((st) => st.completed);

        const updatedTaskData: Partial<Task> = {
          subtasks: updatedSubtasks,
          completed: allSubtasksCompleted,
          completedAt: allSubtasksCompleted ? new Date().toISOString() : null,
        };
        const taskRef = doc(firestore, 'tasks', taskId);
        await updateDocumentNonBlocking(taskRef, updatedTaskData as any);
      } catch (error) {
        console.error('Failed to toggle subtask:', error);
        toast({
          title: 'Error',
          description: 'Failed to toggle subtask status.',
          variant: 'destructive',
        });
      }
    },
    [firestore, tasks, toast]
  );

  const deleteSubtask = useCallback(
    async (taskId: string, subtaskId: string) => {
      if (!tasks) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      try {
        const updatedSubtasks = (task.subtasks || []).filter(
          (st) => st.id !== subtaskId
        );
        const allSubtasksCompleted =
          updatedSubtasks.length > 0 &&
          updatedSubtasks.every((st) => st.completed);

        const updatedTaskData: Partial<Task> = {
          subtasks: updatedSubtasks,
          completed: allSubtasksCompleted,
          completedAt: allSubtasksCompleted ? new Date().toISOString() : null,
        };

        const taskRef = doc(firestore, 'tasks', taskId);
        await updateDocumentNonBlocking(taskRef, updatedTaskData as any);
      } catch (error) {
        console.error('Failed to delete subtask:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete subtask.',
          variant: 'destructive',
        });
      }
    },
    [firestore, tasks, toast]
  );

  return {
    tasks: tasks || [],
    linkGroups: linkGroups || [],
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
  };
}
