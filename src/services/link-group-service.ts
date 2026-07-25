'use server';

import { db } from '@/lib/firebase-admin';
import type { LinkGroup } from '@/types';

const COLLECTION_NAME = 'link-groups';

export async function getLinkGroups(): Promise<LinkGroup[]> {
  try {
    const snapshot = await db.collection(COLLECTION_NAME).get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as LinkGroup));
  } catch (error) {
    console.error('Error getting link groups:', error);
    throw new Error('Failed to fetch link groups');
  }
}

export async function addLinkGroup(group: Omit<LinkGroup, 'id'>): Promise<LinkGroup> {
  const docRef = await db.collection(COLLECTION_NAME).add(group);
  const doc = await docRef.get();
  return { id: doc.id, ...doc.data() } as LinkGroup;
}

export async function updateLinkGroup(id: string, data: Partial<LinkGroup>): Promise<void> {
  await db.collection(COLLECTION_NAME).doc(id).update(data);
}

export async function deleteLinkGroup(id: string): Promise<void> {
  await db.collection(COLLECTION_NAME).doc(id).delete();
}