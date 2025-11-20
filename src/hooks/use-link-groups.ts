'use client';

import { useCallback, useMemo } from 'react';
import { collection, doc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { LinkGroup } from '@/types';
import { useToast } from './use-toast';
import {
  addDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';

export function useLinkGroups() {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();

  const linkGroupsCollection = useMemoFirebase(
    () =>
      !isUserLoading && user
        ? collection(firestore, 'users', user.uid, 'link-groups')
        : null,
    [firestore, user, isUserLoading]
  );

  const { data: linkGroups, isLoading } = useCollection<LinkGroup>(linkGroupsCollection);

  const addLinkGroup = useCallback(
    async (name: string, links: string[]) => {
      if (!linkGroupsCollection) return;
      try {
        await addDoc(linkGroupsCollection, { name, links });
      } catch (error) {
        console.error('Failed to add link group:', error);
        toast({
          title: 'Error',
          description: 'Failed to add the new link group.',
          variant: 'destructive',
        });
      }
    },
    [firestore, toast, linkGroupsCollection]
  );

  const updateLinkGroup = useCallback(
    async (id: string, name: string, links: string[]) => {
      if (!user) return;
      try {
        const linkGroupRef = doc(firestore, 'users', user.uid, 'link-groups', id);
        await updateDoc(linkGroupRef, { name, links });
      } catch (error) {
        console.error('Failed to update link group:', error);
        toast({
          title: 'Error',
          description: 'Failed to update the link group.',
          variant: 'destructive',
        });
      }
    },
    [firestore, toast, user]
  );

  const deleteLinkGroup = useCallback(
    async (id: string) => {
      if (!user) return;
      try {
        const linkGroupRef = doc(firestore, 'users', user.uid, 'link-groups', id);
        await deleteDoc(linkGroupRef);
      } catch (error) {
        console.error('Failed to delete link group:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete the link group.',
          variant: 'destructive',
        });
      }
    },
    [firestore, toast, user]
  );

  return {
    linkGroups: linkGroups || [],
    addLinkGroup,
    updateLinkGroup,
    deleteLinkGroup,
    isLoading: isLoading || isUserLoading,
  };
}
