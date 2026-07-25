'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useBudget() {
  const [budgetData, setBudgetData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    console.log("Initializing overall Budget listener...");

    const q = query(collection(db, 'monthly-budget-items'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setBudgetData(data);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error (monthly-budget-items):", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { budgetData, loading };
}