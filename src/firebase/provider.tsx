
'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

// Define the shape of the context
interface FirebaseContextType {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
}

// Create the context with a null default value
const FirebaseContext = createContext<FirebaseContextType | null>(null);

// Provider component
interface FirebaseProviderProps {
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
}

export function FirebaseProvider({
  children,
  firebaseApp,
  firestore,
}: FirebaseProviderProps) {
  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      firebaseApp,
      firestore,
    }),
    [firebaseApp, firestore]
  );

  return (
    <FirebaseContext.Provider value={value}>
      {children}
      <FirebaseErrorListener />
    </FirebaseContext.Provider>
  );
}

// Custom hooks for accessing Firebase instances
export function useFirebase() {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider.');
  }
  return context;
}

export function useFirebaseApp() {
  return useFirebase().firebaseApp;
}

export function useFirestore() {
  return useFirebase().firestore;
}
