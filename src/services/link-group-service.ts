
'use server';

import { db } from '@/lib/firebase-admin';
import type { LinkGroup } from '@/types';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, Firestore } from 'firebase/firestore';

const LINK_GROUPS_COLLECTION = 'link-groups';

export async function getLinkGroups(db: Firestore): Promise<LinkGroup[]> {
  const linkGroupsCollection = collection(db, LINK_GROUPS_COLLECTION);
  const q = query(linkGroupsCollection);
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LinkGroup));
}

export async function addLinkGroup(db: Firestore, name: string, links: string[]): Promise<LinkGroup> {
  const docRef = await addDoc(collection(db, LINK_GROUPS_COLLECTION), { name, links });
  return { id: docRef.id, name, links };
}

export async function updateLinkGroup(db: Firestore, id: string, name: string, links: string[]): Promise<void> {
  const linkGroupRef = doc(db, LINK_GROUPS_COLLECTION, id);
  await updateDoc(linkGroupRef, { name, links });
}

export async function deleteLinkGroup(db: Firestore, id: string): Promise<void> {
  const linkGroupRef = doc(db, LINK_GROUPS_COLLECTION, id);
  await deleteDoc(linkGroupRef);
}
