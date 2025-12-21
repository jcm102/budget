
'use server';

import { db } from '@/lib/firebase-admin';
import type { Person } from '@/types';
import { collection, getDocs, doc, deleteDoc, query, orderBy, addDoc, updateDoc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';

const PEOPLE_COLLECTION = 'people';


export async function getPeople(): Promise<Person[]> {
  const peopleCollection = collection(db, PEOPLE_COLLECTION);
  const q = query(peopleCollection, orderBy('createdAt'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return { 
          id: doc.id, 
          ...data,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString()
        } as Person
    });
}

export async function addPerson(name: string): Promise<Person> {
  const peopleCollection = collection(db, PEOPLE_COLLECTION);
  const docData = { name, createdAt: serverTimestamp() };
  const docRef = await addDoc(peopleCollection, docData);
  return { id: docRef.id, name, createdAt: new Date().toISOString() };
}

export async function updatePerson(id: string, name: string): Promise<void> {
    const personRef = doc(db, PEOPLE_COLLECTION, id);
    await updateDoc(personRef, { name });
}


export async function deletePerson(id: string): Promise<void> {
  const personRef = doc(db, PEOPLE_COLLECTION, id);
  await deleteDoc(personRef);
}
