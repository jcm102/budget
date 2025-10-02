'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Debt } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from './ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Calculator, Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useDebt } from '@/hooks/use-debt';
import { useToast } from '@/hooks/use-toast';
import * as DebtService from '@/services/debt-service';

interface ScheduleEntry {
  month: number;
  payments: Record<string, number>; // { debtId: paymentAmount }
  balances: Record<string, number>; // { debtId: remainingBalance }
  totalPaid: number;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function DebtSnowballCalculator({ debts: initialDebts }: { debts: Debt[] }) {
  const { debts: liveDebts, fetchDebts } = useDebt();
  const [totalMonthlyPayment, setTotalMonthlyPayment] = useState<number>(0);
  const [extraPayment, setExtraPayment] = useState<number>(0);
  const [extraPaymentTarget, setExtraPaymentTarget] = useState<string>('highest_interest');
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const { toast } = useToast();

  const debts = useMemo(() => liveDebts.length > 0 ? liveDebts : initialDebts, [liveDebts, initialDebts]);

  useEffect(() => {
    const savedState = localStorage.getItem('debtCalculatorState');
    if (savedState) {
      try {
        const { totalMonthlyPayment, extraPayment, extraPaymentTarget } = JSON.parse(savedState);
        setTotalMonthlyPayment(totalMonthlyPayment || 0);
        setExtraPayment(extraPayment || 0);
        setExtraPaymentTarget(extraPaymentTarget || 'highest_interest');
      } catch (e) {
        console.error("Failed to parse debt calculator state from localStorage", e);
      }
    }
  }, []);

  useEffect(() => {
    const stateToSave = {
      totalMonthlyPayment,
      extraPayment,
      extraPaymentTarget,
    };
    localStorage.setItem('debtCalculatorState', JSON.stringify(stateToSave));
  }, [totalMonthlyPayment, extraPayment, extraPaymentTarget]);


  const totalMinimumPayment = useMemo(() => {
    return debts.reduce((sum, debt) => sum + (debt.nextMinimumPayment || 0), 0);
  }, [debts]);


  useEffect(() => {
    if (totalMinimumPayment > 0 && totalMonthlyPayment < totalMinimumPayment) {
      setTotalMonthlyPayment(totalMinimumPayment);
    }
  }, [totalMinimumPayment, totalMonthlyPayment]);
  
  useEffect(() => {
    const calculateSchedule = () => {
        setError(null);

        if (totalMonthlyPayment < totalMinimumPayment) {
            setError(`Total monthly payment must be at least the sum of minimum payments (${formatCurrency(totalMinimumPayment)}).`);
            setSchedule([]);
            return;
        }
        
        let currentDebts = debts
            .filter(d => (d.nextBalance || 0) > 0)
            .map(d => ({ 
                id: d.id, 
                name: d.name,
                balance: d.nextBalance || 0,
                interestRate: d.interestRate / 100, 
                minimumPayment: d.nextMinimumPayment || 0 
            }));

        if (currentDebts.length === 0) {
            setSchedule([]); 
            return;
        }
        
        if (extraPayment > 0 && extraPaymentTarget !== 'none') {
            let targetDebt;
            if (extraPaymentTarget === 'highest_interest') {
                targetDebt = [...currentDebts].sort((a,b) => b.interestRate - a.interestRate)[0];
            } else {
                targetDebt = currentDebts.find(d => d.id === extraPaymentTarget);
            }

            if (targetDebt) {
                targetDebt.balance -= extraPayment;
            }
        }


        const newSchedule: ScheduleEntry[] = [];
        let month = 0;
        
         while (currentDebts.some(d => d.balance > 0) && month < 360) {
            month++;
            
            let paymentForMonth = totalMonthlyPayment;
            const monthlyPayments: Record<string, number> = {};

            currentDebts.forEach(debt => {
                const monthlyInterest = debt.balance * (debt.interestRate / 12);
                debt.balance += monthlyInterest;
            });

            for (const debt of currentDebts) {
                 if (debt.balance > 0) {
                    const paymentAmount = Math.min(debt.minimumPayment, debt.balance);
                    monthlyPayments[debt.id] = (monthlyPayments[debt.id] || 0) + paymentAmount;
                    debt.balance -= paymentAmount;
                    paymentForMonth -= paymentAmount;
                }
            }
            
            currentDebts.sort((a, b) => b.interestRate - a.interestRate);

            if (paymentForMonth > 0) {
                for (const debt of currentDebts) {
                    if (debt.balance > 0) {
                        const extraPaymentAmount = Math.min(paymentForMonth, debt.balance);
                        monthlyPayments[debt.id] = (monthlyPayments[debt.id] || 0) + extraPaymentAmount;
                        debt.balance -= extraPaymentAmount;
                        paymentForMonth -= extraPaymentAmount;
                        if (paymentForMonth <= 0.01) break;
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

    calculateSchedule();
  }, [totalMonthlyPayment, extraPayment, extraPaymentTarget, debts, totalMinimumPayment]);
  
  const handleApplySchedule = async () => {
    if (schedule.length === 0) {
      toast({
        title: "No Schedule",
        description: "Please calculate a schedule first.",
        variant: "destructive",
      });
      return;
    }
    setIsApplying(true);
    try {
      const firstMonthPayments = schedule[0].payments;
      await DebtService.applyPaymentsToBudget(firstMonthPayments);
      await fetchDebts();
      toast({
        title: "Success!",
        description: "Next month's minimum payments have been updated on the Debt Worksheet.",
      });
    } catch (error: any) {
      toast({
        title: "Error Applying Schedule",
        description: error.message || "Could not apply the payment schedule.",
        variant: "destructive",
      });
    } finally {
      setIsApplying(false);
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            Debt Repayment Calculator
        </CardTitle>
        <CardDescription>
          Enter your total monthly debt payment to see a projected repayment schedule using the debt avalanche (highest interest rate) method. The schedule will update as you type.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
            <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="total-payment">Total Monthly Debt Payment</Label>
                <Input
                    id="total-payment"
                    type="number"
                    value={totalMonthlyPayment || ''}
                    onChange={(e) => setTotalMonthlyPayment(parseFloat(e.target.value) || 0)}
                    placeholder={formatCurrency(totalMinimumPayment)}
                />
            </div>
             <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="extra-payment">Extra One-Time Payment</Label>
                <Input
                    id="extra-payment"
                    type="number"
                    value={extraPayment || ''}
                    onChange={(e) => setExtraPayment(parseFloat(e.target.value) || 0)}
                    placeholder="e.g., 500"
                />
            </div>
             <div className="grid w-full items-center gap-1.5">
                <Label htmlFor="extra-payment-target">Apply Extra Payment To</Label>
                 <Select onValueChange={setExtraPaymentTarget} value={extraPaymentTarget}>
                    <SelectTrigger id="extra-payment-target">
                        <SelectValue placeholder="Select a debt" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="highest_interest">Highest Interest Rate (Default)</SelectItem>
                        {debts.filter(d => (d.nextBalance || 0) > 0).map(debt => (
                            <SelectItem key={debt.id} value={debt.id}>{debt.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
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
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Repayment Schedule</CardTitle>
                        <div className="text-sm text-muted-foreground">
                            Based on your inputs, it will take an estimated <Badge variant="secondary">{schedule.length} months</Badge> to become debt-free.
                        </div>
                    </div>
                    <Button onClick={handleApplySchedule} disabled={isApplying}>
                        {isApplying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Apply Plan to Next Month
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="overflow-x-auto relative max-h-[500px]">
                    <Table>
                        <TableHeader className="sticky top-0 bg-secondary z-10">
                            <TableRow>
                                <TableHead className="w-[80px]">Month</TableHead>
                                {debts.filter(d => (d.nextBalance || 0) > 0).map(debt => (
                                    <TableHead key={debt.id} className="text-right min-w-[120px]">{debt.name}</TableHead>
                                ))}
                                <TableHead className="text-right font-bold">Total Paid</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {schedule.map(entry => (
                                <TableRow key={entry.month}>
                                    <TableCell>{entry.month}</TableCell>
                                    {debts.filter(d => (d.nextBalance || 0) > 0).map(debt => {
                                        const payment = entry.payments[debt.id];
                                        const balance = entry.balances[debt.id];
                                        
                                        const isPaidOffThisMonth = balance <= 0 && (entry.month === 1 || schedule[entry.month - 2].balances[debt.id] > 0);

                                        return (
                                            <TableCell key={debt.id} className="text-right">
                                                {isPaidOffThisMonth ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-destructive font-medium">-{formatCurrency(payment || 0)}</span>
                                                        <span className="text-xs text-green-600 font-bold">Paid Off</span>
                                                    </div>
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