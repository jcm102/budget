
'use client';

import { useState, useEffect } from 'react';
import { useExchangeRate } from '@/hooks/use-exchange-rate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from './ui/skeleton';

export function ExchangeRateManager() {
  const { exchangeRate, updateExchangeRate, isLoading } = useExchangeRate();
  const [rate, setRate] = useState<number | string>('');

  useEffect(() => {
    if (exchangeRate !== null) {
      setRate(exchangeRate);
    }
  }, [exchangeRate]);

  const handleSave = () => {
    const numericRate = Number(rate);
    if (!isNaN(numericRate) && numericRate > 0) {
      updateExchangeRate(numericRate);
    }
  };

  const renderLoadingSkeleton = () => (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>USD to CAD Exchange Rate</CardTitle>
        <CardDescription>
          Set the current exchange rate to calculate CAD contributions for USD sinking funds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          renderLoadingSkeleton()
        ) : (
          <Input
            type="number"
            step="0.0001"
            placeholder="e.g., 1.35"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={isLoading}>Save Rate</Button>
      </CardFooter>
    </Card>
  );
}
