'use client';

import { useState, useEffect, useCallback } from 'react';
import type { LinkGroup } from '@/types';
import { useToast } from './use-toast';
import * as LinkGroupService from '@/services/link-group-service';

export function useLinkGroups() {
  const [linkGroups, setLinkGroups] = useState<LinkGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchLinkGroups = async () => {
      try {
        setIsLoading(true);
        const fetchedGroups = await LinkGroupService.getLinkGroups();
        setLinkGroups(fetchedGroups);
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
  }, [toast]);

  const addLinkGroup = useCallback(async (name: string, links: string[]) => {
    try {
      const newGroup = await LinkGroupService.addLinkGroup(name, links);
      setLinkGroups((prev) => [...prev, newGroup].sort((a,b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Failed to add link group:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new link group.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const updateLinkGroup = useCallback(async (id: string, name: string, links: string[]) => {
    const originalGroups = linkGroups;
    setLinkGroups((prev) => 
        prev.map(g => g.id === id ? { ...g, name, links } : g)
            .sort((a,b) => a.name.localeCompare(b.name))
    );
    try {
        await LinkGroupService.updateLinkGroup(id, name, links);
    } catch (error) {
        console.error('Failed to update link group:', error);
        setLinkGroups(originalGroups);
        toast({
            title: 'Error',
            description: 'Failed to update the link group.',
            variant: 'destructive',
        });
    }
  }, [linkGroups, toast]);

  const deleteLinkGroup = useCallback(async (id: string) => {
    const originalGroups = linkGroups;
    setLinkGroups((prev) => prev.filter((group) => group.id !== id));
    try {
      await LinkGroupService.deleteLinkGroup(id);
    } catch (error) {
      console.error('Failed to delete link group:', error);
      setLinkGroups(originalGroups);
      toast({
        title: 'Error',
        description: 'Failed to delete the link group.',
        variant: 'destructive',
      });
    }
  }, [linkGroups, toast]);

  return { linkGroups, addLinkGroup, updateLinkGroup, deleteLinkGroup, isLoading };
}
