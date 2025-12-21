

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LinkGroup } from '@/types';
import { useToast } from './use-toast';
import * as LinkGroupService from '@/services/link-group-service';
import { useFirestore } from '@/firebase';

export function useLinkGroups() {
  const [linkGroups, setLinkGroups] = useState<LinkGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const db = useFirestore();

  useEffect(() => {
    const fetchLinkGroups = async () => {
      if (!db) return;
      try {
        setIsLoading(true);
        const fetchedLinkGroups = await LinkGroupService.getLinkGroups(db);
        setLinkGroups(fetchedLinkGroups);
      } catch (error) {
        console.error('Failed to load link groups:', error);
        toast({
          title: 'Error',
          description: 'Failed to load link groups from the database.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchLinkGroups();
  }, [toast, db]);

  const addLinkGroup = useCallback(async (name: string, links: string[]) => {
    if (!db) return;
    try {
      const newGroup = await LinkGroupService.addLinkGroup(db, name, links);
      setLinkGroups((prev) => [...prev, newGroup]);
    } catch (error) {
      console.error('Failed to add link group:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new link group.',
        variant: 'destructive',
      });
    }
  }, [toast, db]);

  const updateLinkGroup = useCallback(async (id: string, name: string, links: string[]) => {
    if (!db) return;
    const originalGroups = [...linkGroups];
    setLinkGroups(prev => prev.map(g => g.id === id ? {...g, name, links} : g));
    try {
        await LinkGroupService.updateLinkGroup(db, id, name, links);
    } catch (error) {
        setLinkGroups(originalGroups);
        console.error('Failed to update link group:', error);
        toast({
          title: 'Error',
          description: 'Failed to update the link group.',
          variant: 'destructive',
        });
    }
  }, [linkGroups, toast, db]);

  const deleteLinkGroup = useCallback(async (id: string) => {
    if (!db) return;
    const originalGroups = linkGroups;
    setLinkGroups((prev) => prev.filter((group) => group.id !== id));
    try {
      await LinkGroupService.deleteLinkGroup(db, id);
    } catch (error) {
      console.error('Failed to delete link group:', error);
      setLinkGroups(originalGroups);
      toast({
        title: 'Error',
        description: 'Failed to delete the link group.',
        variant: 'destructive',
      });
    }
  }, [linkGroups, toast, db]);

  return { linkGroups, addLinkGroup, updateLinkGroup, deleteLinkGroup, isLoading };
}

    