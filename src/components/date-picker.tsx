
'use client';

export function DatePicker({ date, setDate }: { date?: string, setDate: (date?: string) => void }) {
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // The value from a date input is already a 'YYYY-MM-DD' string.
        // We just pass it up directly.
        setDate(e.target.value || undefined);
    };
    
    return (
        <input 
            type="date"
            value={date || ''}
            onChange={handleDateChange}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
    )
}
