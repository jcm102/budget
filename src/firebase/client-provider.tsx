'use client';

import React, { useMemo, type ReactNode } from 'react';
import { initializeFirebase } from '@/firebase';

// This provider is now effectively a passthrough and doesn't do much.
// It's kept for structural consistency in case Firebase services are re-introduced later.
export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
