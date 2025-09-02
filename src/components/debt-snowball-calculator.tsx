
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Debt } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calculator } from 'lucide-react';
import { Badge } from './ui/badge';

interface ScheduleEntry {
  month: number;
  payments: Record<string, number>; // { debtId: paymentAmount }
  balances: Record<string, number>; // { debtId: remainingBalance }
  totalPaid: number;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function DebtSnowballCalculator({ debts }: { debts: Debt[] }) {
  const [totalMonthlyPayment, setTotalMonthlyPayment] = useState<number>(0);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const totalMinimumPayment = useMemo(() => {
    return debts.reduce((sum, debt) => sum + debt.minimumPayment, 0);
  }, [debts]);

  useEffect(() => {
    if (totalMinimumPayment > 0) {
      setTotalMonthlyPayment(totalMinimumPayment);
    }
  }, [totalMinimumPayment]);
  
  const calculateSchedule = () => {
    setError(null);
    setSchedule([]);

    if (totalMonthlyPayment < totalMinimumPayment) {
        setError(`Total monthly payment must be at least the sum of minimum payments (${formatCurrency(totalMinimumPayment)}).`);
        return;
    }

    let currentDebts = debts
        .filter(d => d.balance > 0)
        .map(d => ({ ...d, balance: d.balance })); // Create mutable copies
        
    if (currentDebts.length === 0) {
        setError("No debts with a positive balance to calculate.");
        return;
    }

    const newSchedule: ScheduleEntry[] = [];
    let month = 1;
    let snowball = totalMonthlyPayment - totalMinimumPayment;

    while (currentDebts.some(d => d.balance > 0) && month < 360) { // Limit to 30 years
        const monthlyPayments: Record<string, number> = {};
        
        // 1. Apply interest to all debts first
        currentDebts.forEach(debt => {
            const interest = (debt.balance * (debt.interestRate / 100)) / 12;
            debt.balance += interest;
        });

        // 2. Sort by balance for snowball method (lowest balance first)
        currentDebts.sort((a, b) => a.balance - b.balance);

        let paymentPool = totalMonthlyPayment;

        // 3. Pay minimums
        for (const debt of currentDebts) {
            const minPayment = Math.min(debt.minimumPayment, debt.balance);
            if (paymentPool >= minPayment) {
                monthlyPayments[debt.id] = (monthlyPayments[debt.id] || 0) + minPayment;
                debt.balance -= minPayment;
                paymentPool -= minPayment;
            } else {
                // Not enough money to even cover minimums, pay what's left
                monthlyPayments[debt.id] = (monthlyPayments[debt.id] || 0) + paymentPool;
                debt.balance -= paymentPool;
                paymentPool = 0;
            }
        }
        
        // 4. Apply snowball (the remaining paymentPool) to the lowest balance debt
        for (const debt of currentDebts) {
            if (paymentPool > 0) {
                const extraPayment = Math.min(paymentPool, debt.balance);
                monthlyPayments[debt.id] = (monthlyPayments[debt.id] || 0) + extraPayment;
                debt.balance -= extraPayment;
                paymentPool -= extraPayment;
            }
        }
        
        // Record balances and total paid for the month
        const monthlyBalances: Record<string, number> = {};
        let totalMonthPayment = 0;
        debts.forEach(debt => {
            const currentDebtState = currentDebts.find(d => d.id === debt.id);
            monthlyBalances[debt.id] = currentDebtState ? currentDebtState.balance : 0;
            totalMonthPayment += (monthlyPayments[debt.id] || 0);
        });

        newSchedule.push({
            month,
            payments: monthlyPayments,
            balances: monthlyBalances,
            totalPaid: totalMonthPayment
        });

        // 5. Filter out paid-off debts for the next iteration
        currentDebts = currentDebts.filter(d => d.balance > 0);
        
        month++;
    }
    setSchedule(newSchedule);
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            Debt Snowball Calculator
        </CardTitle>
        <CardDescription>
          Enter your total monthly debt payment to see a projected repayment schedule using the debt snowball method.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row items-end gap-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
                <Label htmlFor="total-payment">Total Monthly Debt Payment</Label>
                <Input
                    id="total-payment"
                    type="number"
                    value={totalMonthlyPayment || ''}
                    onChange={(e) => setTotalMonthlyPayment(parseFloat(e.target.value) || 0)}
                    placeholder={formatCurrency(totalMinimumPayment)}
                />
            </div>
            <Button onClick={calculateSchedule}>Calculate Schedule</Button>
        </div>
        {error && <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
        </Alert>}
      </CardContent>
      {schedule.length > 0 && (
         <>
            <Separator />
            <CardHeader>
                <CardTitle>Repayment Schedule</CardTitle>
                <div className="text-sm text-muted-foreground">
                    Based on your inputs, it will take an estimated <Badge variant="secondary">{schedule.length} months</Badge> to become debt-free.
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto relative max-h-[500px]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-secondary z-10">
                            <TableRow>
                                <TableHead className="w-[80px]">Month</TableHead>
                                {debts.map(debt => (
                                    <TableHead key={debt.id} className="text-right min-w-[120px]">{debt.name}</TableHead>
                                ))}
                                <TableHead className="text-right font-bold">Total Paid</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {schedule.map(entry => (
                                <TableRow key={entry.month}>
                                    <TableCell>{entry.month}</TableCell>
                                    {debts.map(debt => {
                                        const payment = entry.payments[debt.id];
                                        const balance = entry.balances[debt.id];
                                        const originalDebt = debts.find(d => d.id === debt.id);
                                        const originalBalance = originalDebt ? originalDebt.balance : 0;
                                        
                                        // Only show the column if the original balance was > 0
                                        if (originalBalance <= 0) {
                                            return <TableCell key={debt.id} className="text-right text-muted-foreground">-</TableCell>;
                                        }

                                        return (
                                            <TableCell key={debt.id} className="text-right">
                                                {balance !== undefined && balance <= 0 && (entry.month > 0 && newSchedule.find(s => s.month === entry.month -1)?.balances[debt.id] > 0) ? (
                                                     <span className="text-green-600 font-bold">Paid Off</span>
                                                ) : balance > 0 ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-destructive font-medium">-{formatCurrency(payment || 0)}</span>
                                                        <span className="text-xs text-muted-foreground">{formatCurrency(balance)}</span>
                                                    </div>
                                                ) : schedule.find(s => s.month < entry.month && s.balances[debt.id] <=0) ? (
                                                    <span className="text-green-600">Paid Off</span>
                                                ) : (
                                                    <div className="flex flex-col">
                                                        <span className="text-destructive font-medium">-{formatCurrency(payment || 0)}</span>
                                                        <span className="text-xs text-muted-foreground">{formatCurrency(balance)}</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                        )
                                    })}
                                    <TableCell className="text-right font-bold">{formatCurrency(entry.totalPaid)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
         </>
      )}
    </Card>
  );
}
