'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateTaskDescription } from '@/ai/flows/generate-task-description';

export function useTasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const q = query(collection(db, 'tasks'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTasks(taskList);
      setLoading(false);
    }, (error) => {
      console.error("Tasks load error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Wrapper function to use the Server Action
  const handleGenerateDescription = async (title: string) => {
    return await generateTaskDescription(title);
  };

  return { tasks, loading, handleGenerateDescription };
}