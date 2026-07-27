'use server';

import { db } from '@/lib/firebase-admin';
import type { CalendarColumn, CalendarRow } from '@/types';

const CALENDAR_COLLECTION = 'payment-calendar';
const CALENDAR_STATE_DOC = 'singleton_state';

interface CalendarState {
  columns: CalendarColumn[];
  rows: CalendarRow[];
}

export async function getCalendarState(): Promise<CalendarState | null> {
  const docSnap = await db.collection(CALENDAR_COLLECTION).doc(CALENDAR_STATE_DOC).get();
  if (docSnap.exists) {
    return docSnap.data() as CalendarState;
  }
  return null;
}

export async function updateCalendarState(state: CalendarState): Promise<void> {
  await db.collection(CALENDAR_COLLECTION).doc(CALENDAR_STATE_DOC).set(state);
}
