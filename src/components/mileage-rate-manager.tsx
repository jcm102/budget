'use client';

import { useState, useEffect } from 'react';
import { useMileageRate } from '@/hooks/use-mileage-rate';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from './ui/skeleton';

export function MileageRateManager() {
  const { mileageRate, updateMileageRate, isLoading } = useMileageRate();
  const [rate, setRate] = useState<number | string>('');

  useEffect(() => {
    if (mileageRate !== null) {
      setRate(mileageRate);
    }
  }, [mileageRate]);

  const handleSave = () => {
    const numericRate = Number(rate);
    if (!isNaN(numericRate) && numericRate >= 0) {
      updateMileageRate(numericRate);
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
        <CardTitle>Default Mileage Rate</CardTitle>
        <CardDescription>
          Set the default reimbursement rate per kilometer for mileage tracking.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          renderLoadingSkeleton()
        ) : (
          <Input
            type="number"
            step="0.01"
            placeholder="e.g., 0.50"
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
