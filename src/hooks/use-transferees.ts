'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { AccountDetails } from '@/types';

export function useTransferees() {
  const [accounts, setAccounts] = useState<AccountDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    console.log("Initializing Transferees listener...");

    const q = query(collection(db, 'transferees'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const accs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as AccountDetails));
      setAccounts(accs);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error (transferees):", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { accounts, loading };
}