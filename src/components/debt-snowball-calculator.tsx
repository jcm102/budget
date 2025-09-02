
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
        .map(d => ({ ...d, balance: d.balance })) // Create mutable copies
        .sort((a, b) => a.balance - b.balance); // Snowball: sort by lowest balance

    if (currentDebts.length === 0) {
        setError("No debts with a positive balance to calculate.");
        return;
    }

    const newSchedule: ScheduleEntry[] = [];
    let month = 1;
    let snowball = totalMonthlyPayment - totalMinimumPayment;

    while (currentDebts.some(d => d.balance > 0) && month < 360) { // Limit to 30 years
        const monthlyPayments: Record<string, number> = {};
        const monthlyBalances: Record<string, number> = {};
        let totalMonthPayment = 0;
        let freedUpPayment = 0;
        
        const targetDebtIndex = currentDebts.findIndex(d => d.balance > 0);
        if (targetDebtIndex === -1) break;
        const targetDebtId = currentDebts[targetDebtIndex].id;

        // Apply interest first
        currentDebts.forEach(debt => {
            const interest = (debt.balance * (debt.interestRate / 100)) / 12;
            debt.balance += interest;
        });

        // Distribute payments
        currentDebts.forEach(debt => {
            if (debt.balance > 0) {
                let payment = debt.minimumPayment;
                if (debt.id === targetDebtId) {
                    payment += snowball;
                }

                const actualPayment = Math.min(payment, debt.balance);
                monthlyPayments[debt.id] = actualPayment;
                debt.balance -= actualPayment;
                totalMonthPayment += actualPayment;

                if (debt.balance <= 0) {
                   freedUpPayment += debt.minimumPayment;
                }
            }
        });
        
        currentDebts.forEach(debt => {
            monthlyBalances[debt.id] = debt.balance;
        });
        
        newSchedule.push({
            month,
            payments: monthlyPayments,
            balances: monthlyBalances,
            totalPaid: totalMonthPayment
        });

        snowball += freedUpPayment;
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
                <CardDescription>
                    Based on your inputs, it will take an estimated <Badge variant="secondary">{schedule.length} months</Badge> to become debt-free.
                </CardDescription>
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
                                        return (
                                            <TableCell key={debt.id} className="text-right">
                                                {balance !== undefined ? (
                                                     balance > 0 || payment > 0 ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-destructive font-medium">-{formatCurrency(payment || 0)}</span>
                                                            <span className="text-xs text-muted-foreground">{formatCurrency(balance)}</span>
                                                        </div>
                                                     ) : <span className="text-green-600">Paid Off</span>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
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
