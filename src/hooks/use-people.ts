
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Person } from '@/types';
import { useToast } from './use-toast';
import * as PersonService from '@/services/person-service';
import { useFirestore } from '@/firebase';

export function usePeople() {
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const db = useFirestore();

  const fetchPeople = useCallback(async () => {
    if (!db) return;
    try {
      setIsLoading(true);
      const fetchedPeople = await PersonService.getPeople(db);
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
  }, [toast, db]);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const addPerson = useCallback(async (name: string) => {
    if (!db) return;
    try {
      const newPerson = await PersonService.addPerson(db, name);
      setPeople((prev) => [...prev, newPerson]);
    } catch (error) {
      console.error('Failed to add person:', error);
      toast({
        title: 'Error',
        description: 'Failed to add the new person.',
        variant: 'destructive',
      });
    }
  }, [toast, db]);

  const updatePerson = useCallback(async (id: string, name: string) => {
    if (!db) return;
      const originalPeople = [...people];
      setPeople(prev => prev.map(p => p.id === id ? {...p, name} : p));
      try {
          await PersonService.updatePerson(db, id, name);
      } catch (error) {
          setPeople(originalPeople);
          console.error('Failed to update person:', error);
          toast({
              title: 'Error',
              description: 'Failed to update person.',
              variant: 'destructive',
          });
      }
  }, [people, toast, db]);

  const deletePerson = useCallback(async (id: string) => {
    if (!db) return;
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
      await PersonService.deletePerson(db, id);
    } catch (error) {
      console.error('Failed to delete person:', error);
      setPeople(originalPeople);
      toast({
        title: 'Error',
        description: 'Failed to delete the person.',
        variant: 'destructive',
      });
    }
  }, [people, toast, db]);

  return { people, addPerson, updatePerson, deletePerson, isLoading };
}
