
'use client';

import { format } from 'date-fns';

export function DatePicker({ date, setDate }: { date?: Date, setDate: (date?: Date) => void }) {
    // This function handles the date change and avoids timezone issues.
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            // The input gives a 'YYYY-MM-DD' string. We parse it and create a Date object
            // ensuring it's interpreted as local time, not UTC, by splitting it.
            const [year, month, day] = e.target.value.split('-').map(Number);
            setDate(new Date(year, month - 1, day));
        } else {
            setDate(undefined);
        }
    };
    
    return (
        <input 
            type="date"
            value={date ? format(date, 'yyyy-MM-dd') : ''}
            onChange={handleDateChange}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
    )
}
