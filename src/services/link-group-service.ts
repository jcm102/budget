'use server';

import { db } from '@/lib/firebase';
import type { LinkGroup } from '@/types';
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
} from 'firebase/firestore';

const LINK_GROUP_COLLECTION = 'link-groups';

export async function getLinkGroups(): Promise<LinkGroup[]> {
  const linkGroupCollection = collection(db, LINK_GROUP_COLLECTION);
  const q = query(linkGroupCollection, orderBy('name'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LinkGroup));
}

export async function addLinkGroup(name: string, links: string[]): Promise<LinkGroup> {
  const linkGroupCollection = collection(db, LINK_GROUP_COLLECTION);
  const docRef = await addDoc(linkGroupCollection, { name, links });
  const docSnap = await getDoc(docRef);
  const newGroup = { id: docSnap.id, ...docSnap.data() } as LinkGroup;
  return newGroup;
}

export async function updateLinkGroup(id: string, name: string, links: string[]): Promise<void> {
    const linkGroupRef = doc(db, LINK_GROUP_COLLECTION, id);
    await updateDoc(linkGroupRef, { name, links });
}

export async function deleteLinkGroup(id: string): Promise<void> {
  const linkGroupRef = doc(db, LINK_GROUP_COLLECTION, id);
  await deleteDoc(linkGroupRef);
}
