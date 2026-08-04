'use client';

import { useSearchParams } from 'next/navigation';
import { useDebt } from '../hooks/use-debt';
import { useMemo, useEffect, useState } from 'react';
import type { Debt, DebtPlanSettings, PlannedAdjustment } from '@/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Printer, Loader2 } from 'lucide-react';
import { format, parse } from 'date-fns';
import * as DebtService from '../services/debt-service';
import { calculatePayoffSchedule, ScheduleEntry } from '../services/debt-calculator';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export default function DebtScheduleReportPage() {
  const searchParams = useSearchParams();
  const month = searchParams.get('month') || format(new Date(), 'yyyy-MM');
  const { debts, isLoading: isDebtsLoading } = useDebt(month);
  
  const [settings, setSettings] = useState<DebtPlanSettings>({
    strategy: 'avalanche',
    totalMonthlyPayment: 0,
    customPriorityOrder: []
  });
  const [adjustments, setAdjustments] = useState<Record<string, PlannedAdjustment[]>>({});
  const [isPlanLoading, setIsPlanLoading] = useState(true);

  const totalMinimumPayment = useMemo(() => {
    return debts.reduce((sum, d) => sum + (d.minimumPayment || 0), 0);
  }, [debts]);

  // Load calculator preferences and overrides from database
  useEffect(() => {
    const loadPlanData = async () => {
      try {
        setIsPlanLoading(true);
        const fetchedSettings = await DebtService.getPlanSettings();
        setSettings(fetchedSettings);
        
        const fetchedAdjustments: Record<string, PlannedAdjustment[]> = {};
        await Promise.all(
          debts.map(async (d) => {
            const adjs = await DebtService.getPlannedAdjustments(d.id);
            fetchedAdjustments[d.id] = adjs;
          })
        );
        setAdjustments(fetchedAdjustments);
      } catch (e) {
        console.error("Failed to load plan settings/adjustments", e);
      } finally {
        setIsPlanLoading(false);
      }
    };
    
    if (debts.length > 0) {
      loadPlanData();
    } else if (!isDebtsLoading) {
      setIsPlanLoading(false);
    }
  }, [debts, isDebtsLoading]);

  const schedule = useMemo(() => {
    return calculatePayoffSchedule(debts, settings, adjustments, month);
  }, [debts, settings, adjustments, month]);

  const handlePrint = () => {
    window.print();
  };

  const isLoading = isDebtsLoading || isPlanLoading;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const monthLabel = format(parse(month + '-01', 'yyyy-MM-dd', new Date()), 'MMMM yyyy');

  return (
    <div className="p-8 max-w-4xl mx-auto bg-white text-black min-h-screen">
      <header className="flex justify-between items-center border-b pb-4 mb-6 no-print">
        <div>
          <h1 className="text-2xl font-bold">Debt Repayment Plan</h1>
          <p className="text-sm text-gray-500">Generated for {monthLabel}</p>
        </div>
        <Button onClick={handlePrint} variant="default" className="flex items-center gap-2">
          <Printer className="h-4 w-4" />
          Print Plan
        </Button>
      </header>

      {/* Printable Header */}
      <div className="hidden print:block mb-8">
        <h1 className="text-3xl font-extrabold text-center uppercase tracking-wide">Debt Repayment Schedule</h1>
        <p className="text-center text-gray-600 font-medium">Month Period: {monthLabel}</p>
        <hr className="mt-4 border-black" />
      </div>

      <section className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 print:bg-transparent print:border p-4 rounded-lg">
        <div>
          <span className="text-xs text-gray-500 uppercase font-semibold">Total Debts</span>
          <p className="text-lg font-bold">{debts.length}</p>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase font-semibold">Repayment Speed</span>
          <p className="text-lg font-bold">{schedule.length} Months</p>
        </div>
        <div>
          <span className="text-xs text-gray-500 uppercase font-semibold">Planned Payment</span>
          <p className="text-lg font-bold">{formatCurrency(Math.max(settings.totalMonthlyPayment || 0, totalMinimumPayment))}/mo</p>
        </div>
        {settings.totalMonthlyPayment > totalMinimumPayment && <div>
          <span className="text-xs text-gray-500 uppercase font-semibold">Extra Payoff Snowball</span>
          <p className="text-lg font-bold text-green-600">{formatCurrency(settings.totalMonthlyPayment - totalMinimumPayment)}/mo</p>
        </div>}
      </section>

      {schedule.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table className="text-xs">
            <TableHeader className="bg-gray-100 font-bold">
              <TableRow className="border-b-2 border-gray-300">
                <TableHead className="w-[80px] font-bold text-black">Month</TableHead>
                {debts.filter(d => (d.balance || 0) > 0).map(debt => (
                  <TableHead key={debt.id} className="text-right font-bold text-black min-w-[100px]">{debt.name}</TableHead>
                ))}
                <TableHead className="text-right font-bold text-black">Total Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedule.map(entry => (
                <TableRow key={entry.month} className="border-b">
                  <TableCell className="font-medium text-black">Month {entry.month}</TableCell>
                  {debts.filter(d => (d.balance || 0) > 0).map(debt => {
                    const payment = entry.payments[debt.id];
                    const balance = entry.balances[debt.id];
                    const isPaidOffThisMonth = balance <= 0 && (entry.month === 1 || schedule[entry.month - 2].balances[debt.id] > 0);

                    return (
                      <TableCell key={debt.id} className="text-right">
                        {isPaidOffThisMonth ? (
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-red-600">-{formatCurrency(payment || 0)}</span>
                            <span className="text-[10px] text-green-600 font-bold uppercase">Paid Off</span>
                          </div>
                        ) : balance > 0 ? (
                          <div className="flex flex-col items-end">
                            <span className="text-red-600">-{formatCurrency(payment || 0)}</span>
                            <span className="text-[10px] text-gray-400">Bal: {formatCurrency(balance)}</span>
                          </div>
                        ) : (
                          <span className="text-green-600/70 font-semibold">Paid Off</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-bold text-black">{formatCurrency(entry.totalPaid)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-center py-8 text-gray-500">No active debts to display.</p>
      )}
    </div>
  );
}
