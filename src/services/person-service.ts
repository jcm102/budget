'use server';

import { db } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Person } from '@/types';

const PEOPLE_COLLECTION = 'people';

export async function getPeople(): Promise<Person[]> {
  const querySnapshot = await db.collection(PEOPLE_COLLECTION).orderBy('createdAt').get();
  return querySnapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.().toISOString() || new Date().toISOString(),
    } as Person;
  });
}

export async function addPerson(name: string): Promise<Person> {
  const docRef = await db.collection(PEOPLE_COLLECTION).add({
    name,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { id: docRef.id, name, createdAt: new Date().toISOString() };
}

export async function updatePerson(id: string, name: string): Promise<void> {
  await db.collection(PEOPLE_COLLECTION).doc(id).update({ name });
}

export async function deletePerson(id: string): Promise<void> {
  await db.collection(PEOPLE_COLLECTION).doc(id).delete();
}
