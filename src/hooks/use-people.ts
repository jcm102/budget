
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Person } from '@/types';
import { useToast } from './use-toast';
import * as PersonService from '@/services/person-service';
import { db } from '@/lib/firebase';

export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchPeople = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedPeople = await PersonService.getPeople();
      setPeople(fetchedPeople);
    } catch (error) {
      console.error('Failed to load people:', error);
      toast({
        title: 'Error',
        description: 'Failed to load people from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const addPerson = useCallback(async (name: string) => {
    try {
      const newPerson = await PersonService.addPerson(name);
      setPeople((prev) => [...prev, newPerson]);
    } catch (error) {
      console.error('Failed to add person:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new person.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const updatePerson = useCallback(async (id: string, name: string) => {
      const originalPeople = [...people];
      setPeople(prev => prev.map(p => p.id === id ? {...p, name} : p));
      try {
          await PersonService.updatePerson(id, name);
      } catch (error) {
          setPeople(originalPeople);
          console.error('Failed to update person:', error);
          toast({
              title: 'Error',
              description: 'Failed to update person.',
              variant: 'destructive',
          });
      }
  }, [people, toast]);

  const deletePerson = useCallback(async (id: string) => {
    if (people.length <= 1) {
        toast({
            title: 'Action Not Allowed',
            description: 'You must have at least one person.',
            variant: 'destructive'
        });
        return;
    }
    const originalPeople = people;
    setPeople((prev) => prev.filter((person) => person.id !== id));
    try {
      await PersonService.deletePerson(id);
    } catch (error) {
      console.error('Failed to delete person:', error);
      setPeople(originalPeople);
      toast({
        title: 'Error',
        description: 'Failed to delete the person.',
        variant: 'destructive',
      });
    }
  }, [people, toast]);

  return { people, addPerson, updatePerson, deletePerson, isLoading };
}
