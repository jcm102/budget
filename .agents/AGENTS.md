# Project Rules

## Date & Timezone Management
When dealing with dates in this project (especially calendar dates, budgets, recurring items, and tasks):
- **Avoid standard `new Date("YYYY-MM-DD")` parsing:** This parses dates at UTC midnight, which causes a timezone shift when formatted or manipulated in the local timezone (leading to backdated items).
- **Use local-safe date parsing:** Always parse date strings using a helper function that breaks the string into year, month, and day to initialize a local `new Date(year, month - 1, day)` object.
- **Safe formatting:** Avoid `.toISOString()` for date-only values. Use `format(date, 'yyyy-MM-dd')` from `date-fns` to keep dates stable.

Example local date parsing utility:
```typescript
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('T')[0].split('-');
  if (parts.length === 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-based
    const day = parseInt(parts[2], 10);
    return new Date(year, month, day);
  }
  return new Date(dateStr);
}
```
