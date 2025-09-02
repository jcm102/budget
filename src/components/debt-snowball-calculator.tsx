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
    } else {
      setTotalMonthlyPayment(0);
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
        .map(d => ({ 
            id: d.id, 
            name: d.name,
            balance: d.balance, 
            interestRate: d.interestRate, 
            minimumPayment: d.minimumPayment 
        }));

    if (currentDebts.length === 0) {
        setError("No debts with a positive balance to calculate.");
        return;
    }

    const newSchedule: ScheduleEntry[] = [];
    let month = 0;
    
     while (currentDebts.some(d => d.balance > 0) && month < 360) { // Limit to 30 years
        month++;
        
        let paymentForMonth = totalMonthlyPayment;
        const monthlyPayments: Record<string, number> = {};

        // Apply interest
        currentDebts.forEach(debt => {
            const monthlyInterest = (debt.balance * (debt.interestRate / 100)) / 12;
            debt.balance += monthlyInterest;
        });

        // Pay minimums on all debts first
        for (const debt of currentDebts) {
            const paymentAmount = Math.min(debt.minimumPayment, debt.balance, paymentForMonth);
            monthlyPayments[debt.id] = (monthlyPayments[debt.id] || 0) + paymentAmount;
            debt.balance -= paymentAmount;
            paymentForMonth -= paymentAmount;
        }
        
        // Sort by balance (smallest first) for snowball payment
        currentDebts.sort((a, b) => a.balance - b.balance);

        // Apply extra payment (snowball) to the smallest debt
        if (paymentForMonth > 0) {
            for (const debt of currentDebts) { // Loop again in sorted order
                if (debt.balance > 0) {
                    const extraPayment = Math.min(paymentForMonth, debt.balance);
                    monthlyPayments[debt.id] = (monthlyPayments[debt.id] || 0) + extraPayment;
                    debt.balance -= extraPayment;
                    paymentForMonth -= extraPayment;
                    if (paymentForMonth <= 0) break;
                }
            }
        }
        
        const monthlyBalances: Record<string, number> = {};
        let totalMonthPayment = 0;
        debts.forEach(debt => {
            const currentDebtState = currentDebts.find(d => d.id === debt.id);
            monthlyBalances[debt.id] = currentDebtState ? Math.max(0, currentDebtState.balance) : 0;
            totalMonthPayment += (monthlyPayments[debt.id] || 0);
        });

        newSchedule.push({
            month,
            payments: monthlyPayments,
            balances: monthlyBalances,
            totalPaid: totalMonthPayment
        });
        
        currentDebts = currentDebts.filter(d => d.balance > 0);
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
                                {debts.filter(d => d.balance > 0).map(debt => (
                                    <TableHead key={debt.id} className="text-right min-w-[120px]">{debt.name}</TableHead>
                                ))}
                                <TableHead className="text-right font-bold">Total Paid</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {schedule.map(entry => (
                                <TableRow key={entry.month}>
                                    <TableCell>{entry.month}</TableCell>
                                    {debts.filter(d => d.balance > 0).map(debt => {
                                        const payment = entry.payments[debt.id];
                                        const balance = entry.balances[debt.id];
                                        
                                        const isPaidOffThisMonth = balance <= 0 && (entry.month === 1 || schedule[entry.month - 2].balances[debt.id] > 0);

                                        return (
                                            <TableCell key={debt.id} className="text-right">
                                                {isPaidOffThisMonth ? (
                                                     <span className="text-green-600 font-bold">Paid Off</span>
                                                ) : balance > 0 ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-destructive font-medium">-{formatCurrency(payment || 0)}</span>
                                                        <span className="text-xs text-muted-foreground">{formatCurrency(balance)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-green-600/70">Paid Off</span>
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
