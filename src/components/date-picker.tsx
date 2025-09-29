
'use client';

import { format } from 'date-fns';

export function DatePicker({ date, setDate }: { date?: Date, setDate: (date?: Date) => void }) {
    return (
        <input 
            type="date"
            value={date ? format(date, 'yyyy-MM-dd') : ''}
            onChange={(e) => setDate(e.target.valueAsDate ? new Date(e.target.valueAsDate.valueOf() + e.target.valueAsDate.getTimezoneOffset() * 60 * 1000) : undefined)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
    )
}
