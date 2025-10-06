
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
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const LINK_GROUP_COLLECTION = 'link-groups';

export async function getLinkGroups(): Promise<LinkGroup[]> {
  const linkGroupCollection = collection(db, LINK_GROUP_COLLECTION);
  const q = query(linkGroupCollection, orderBy('name'));
  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LinkGroup));
  } catch (error: any) {
     if (error.code === 'permission-denied') {
      const contextualError = new FirestorePermissionError({
        operation: 'list',
        path: LINK_GROUP_COLLECTION,
      });
      errorEmitter.emit('permission-error', contextualError);
    }
    throw error;
  }
}

export async function addLinkGroup(name: string, links: string[]): Promise<LinkGroup> {
  const linkGroupCollection = collection(db, LINK_GROUP_COLLECTION);
  const data = { name, links };
  const docRef = await addDoc(linkGroupCollection, data).catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: LINK_GROUP_COLLECTION,
        operation: 'create',
        requestResourceData: data,
      })
    );
    throw error;
  });
  const docSnap = await getDoc(docRef);
  const newGroup = { id: docSnap.id, ...docSnap.data() } as LinkGroup;
  return newGroup;
}

export async function updateLinkGroup(id: string, name: string, links: string[]): Promise<void> {
    const linkGroupRef = doc(db, LINK_GROUP_COLLECTION, id);
    const data = { name, links };
    await updateDoc(linkGroupRef, data).catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: linkGroupRef.path,
          operation: 'update',
          requestResourceData: data,
        })
      );
    });
}

export async function deleteLinkGroup(id: string): Promise<void> {
  const linkGroupRef = doc(db, LINK_GROUP_COLLECTION, id);
  await deleteDoc(linkGroupRef).catch(error => {
    errorEmitter.emit(
      'permission-error',
      new FirestorePermissionError({
        path: linkGroupRef.path,
        operation: 'delete',
      })
    );
  });
}
