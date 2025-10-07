
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LinkGroup } from '@/types';
import { useToast } from './use-toast';
import * as LinkGroupService from '@/services/link-group-service';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

export function useLinkGroups() {
  const [linkGroups, setLinkGroups] = useState<LinkGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchLinkGroups = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedLinkGroups = await LinkGroupService.getLinkGroups();
      setLinkGroups(fetchedLinkGroups);
    } catch (error: any) {
      console.error('Failed to load link groups:', error);
       if (error.code === 'permission-denied') {
          const contextualError = new FirestorePermissionError({
            operation: 'list',
            path: 'link-groups',
          });
          errorEmitter.emit('permission-error', contextualError);
        }
      toast({
        title: 'Error',
        description: 'Failed to load link groups from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLinkGroups();
  }, [fetchLinkGroups]);

  const addLinkGroup = useCallback(async (name: string, links: string[]) => {
    try {
      await LinkGroupService.addLinkGroup(name, links);
      await fetchLinkGroups();
    } catch (error) {
      console.error('Failed to add link group:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new link group.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchLinkGroups]);

  const updateLinkGroup = useCallback(async (id: string, name: string, links: string[]) => {
    try {
      await LinkGroupService.updateLinkGroup(id, name, links);
      await fetchLinkGroups();
    } catch (error) {
      console.error('Failed to update link group:', error);
      toast({
        title: 'Error',
        description: 'Failed to update the link group.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchLinkGroups]);


  const deleteLinkGroup = useCallback(async (id: string) => {
    try {
      await LinkGroupService.deleteLinkGroup(id);
      await fetchLinkGroups();
    } catch (error) {
      console.error('Failed to delete link group:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete the link group.',
        variant: 'destructive',
      });
    }
  }, [toast, fetchLinkGroups]);

  return { linkGroups, addLinkGroup, updateLinkGroup, deleteLinkGroup, isLoading };
}
