
'use client';

import { Firestore, doc, getDoc, setDoc } from 'firebase/firestore';
import type { CalendarColumn, CalendarRow } from '@/types';

const CALENDAR_COLLECTION = 'payment-calendar';
const CALENDAR_STATE_DOC = 'singleton_state';

interface CalendarState {
    columns: CalendarColumn[];
    rows: CalendarRow[];
}

export async function getCalendarState(db: Firestore): Promise<CalendarState | null> {
  const docRef = doc(db, CALENDAR_COLLECTION, CALENDAR_STATE_DOC);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return docSnap.data() as CalendarState;
  } else {
    // If the document doesn't exist, it's the first run or has been cleared.
    // Return null to allow the hook to initialize a default state.
    return null;
  }
}

export async function updateCalendarState(db: Firestore, state: CalendarState): Promise<void> {
  const docRef = doc(db, CALENDAR_COLLECTION, CALENDAR_STATE_DOC);
  // Using setDoc with merge: false will overwrite the entire document, which is what we want.
  await setDoc(docRef, state);
}
