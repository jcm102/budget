
'use client';

import { useCallback } from 'react';
import { collection, doc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { LinkGroup } from '@/types';
import { useToast } from './use-toast';
import {
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';

export function useLinkGroups() {
  const { toast } = useToast();
  const firestore = useFirestore();
  
  const linkGroupsCollection = useMemoFirebase(
      () => collection(firestore, 'link-groups'),
      [firestore]
  );

  const { data: linkGroups, isLoading } = useCollection<LinkGroup>(linkGroupsCollection);

  const addLinkGroup = useCallback(
    async (name: string, links: string[]) => {
      if (!linkGroupsCollection) return;
      try {
        await addDocumentNonBlocking(linkGroupsCollection, { name, links });
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
      try {
        const linkGroupRef = doc(firestore, 'link-groups', id);
        await updateDocumentNonBlocking(linkGroupRef, { name, links });
      } catch (error) {
        console.error('Failed to update link group:', error);
        toast({
          title: 'Error',
          description: 'Failed to update the link group.',
          variant: 'destructive',
        });
      }
    },
    [firestore, toast]
  );

  const deleteLinkGroup = useCallback(
    async (id: string) => {
      try {
        const linkGroupRef = doc(firestore, 'link-groups', id);
        await deleteDocumentNonBlocking(linkGroupRef);
      } catch (error) {
        console.error('Failed to delete link group:', error);
        toast({
          title: 'Error',
          description: 'Failed to delete the link group.',
          variant: 'destructive',
        });
      }
    },
    [firestore, toast]
  );

  return {
    linkGroups: linkGroups || [],
    addLinkGroup,
    updateLinkGroup,
    deleteLinkGroup,
    isLoading,
  };
}
