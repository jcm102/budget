
'use server';

import { db } from '@/lib/firebase';
import type { Person } from '@/types';
import {
  collection,
  getDocs,
  doc,
  deleteDoc,
  query,
  orderBy,
  addDoc,
  updateDoc,
  getDoc,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

const PEOPLE_COLLECTION = 'people';

async function seedDefaultPeople() {
  const peopleCollectionRef = collection(db, PEOPLE_COLLECTION);
  const snapshot = await getDocs(query(peopleCollectionRef));
  
  if (snapshot.empty) {
    const batch = writeBatch(db);
    const defaultPeople = ['Person 1', 'Person 2'];
    defaultPeople.forEach(personName => {
      const newDocRef = doc(peopleCollectionRef);
      batch.set(newDocRef, { name: personName, createdAt: serverTimestamp() });
    });
    await batch.commit();
  }
}

export async function getPeople(): Promise<Person[]> {
  await seedDefaultPeople();
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
