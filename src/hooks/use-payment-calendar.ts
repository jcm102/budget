
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { CalendarColumn, CalendarRow } from '@/types';
import { useToast } from './use-toast';
import * as PaymentCalendarService from '@/services/payment-calendar-service';
import { useDebounce } from './use-debounce';

export function usePaymentCalendar() {
  const [columns, setColumns] = useState<CalendarColumn[]>([]);
  const [rows, setRows] = useState<CalendarRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const debouncedColumns = useDebounce(columns, 500);
  const debouncedRows = useDebounce(rows, 500);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await PaymentCalendarService.getCalendarState();
      if (data) {
        setColumns(data.columns);
        setRows(data.rows);
      } else {
        // Initialize with default state if nothing in DB
        setColumns([{ id: crypto.randomUUID(), payeeId: '' }]);
        setRows([{ id: crypto.randomUUID(), description: '', values: {} }]);
      }
    } catch (error) {
      console.error('Failed to load calendar state:', error);
      toast({
        title: 'Error',
        description: 'Could not load payment calendar data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Effect to save debounced state to Firestore
  useEffect(() => {
    if (!isLoading) {
      PaymentCalendarService.updateCalendarState({ columns: debouncedColumns, rows: debouncedRows });
    }
  }, [debouncedColumns, debouncedRows, isLoading]);


  const addColumn = () => {
    setColumns(prev => [...prev, { id: crypto.randomUUID(), payeeId: '' }]);
  };

  const updateColumn = (id: string, updatedColumn: CalendarColumn) => {
    setColumns(prev => prev.map(c => c.id === id ? updatedColumn : c));
  };

  const removeColumn = (id: string) => {
    setColumns(prev => prev.filter(c => c.id !== id));
    setRows(prev => prev.map(row => {
      const newValues = { ...row.values };
      delete newValues[id];
      return { ...row, values: newValues };
    }));
  };

  const addRow = () => {
    setRows(prev => [...prev, { id: crypto.randomUUID(), description: '', values: {} }]);
  };

  const updateRow = (id: string, updatedRow: CalendarRow) => {
    setRows(prev => prev.map(r => r.id === id ? updatedRow : r));
  };
  
  const removeRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };
  
  const clearAll = async () => {
    const defaultColumns = [{ id: crypto.randomUUID(), payeeId: '' }];
    const defaultRows = [{ id: crypto.randomUUID(), description: '', values: {} }];
    setColumns(defaultColumns);
    setRows(defaultRows);
    try {
      await PaymentCalendarService.updateCalendarState({ columns: defaultColumns, rows: defaultRows });
      toast({ title: 'Success', description: 'Payment calendar has been cleared.'});
    } catch (error) {
       toast({ title: 'Error', description: 'Could not clear the calendar.', variant: 'destructive'});
    }
  }

  return {
    columns,
    rows,
    isLoading,
    addColumn,
    updateColumn,
    removeColumn,
    addRow,
    updateRow,
    removeRow,
    clearAll,
  };
}
