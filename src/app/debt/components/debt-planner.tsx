'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Debt, DebtPlanSettings, PlannedAdjustment } from '@/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Calculator, ArrowUp, ArrowDown, Trash2, Calendar, Sparkles, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { format, addMonths, parse } from 'date-fns';
import * as DebtService from '../services/debt-service';
import { calculatePayoffSchedule } from '../services/debt-calculator';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export function DebtPlanner({ debts, month, onRefresh }: { debts: Debt[]; month: string; onRefresh: () => void }) {
  const { toast } = useToast();
  const [settings, setSettings] = useState<DebtPlanSettings>({
    strategy: 'avalanche',
    totalMonthlyPayment: 0,
    customPriorityOrder: []
  });
  const [adjustments, setAdjustments] = useState<Record<string, PlannedAdjustment[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedMonths, setExpandedMonths] = useState<Record<number, boolean>>({ 1: true }); // Month 1 open by default

  // Form states for adding adjustment
  const [adjTargetMonth, setAdjTargetMonth] = useState<string>(month);
  const [adjDebtId, setAdjDebtId] = useState<string>('');
  const [adjType, setAdjType] = useState<'charge' | 'fee' | 'windfall'>('charge');
  const [adjAmount, setAdjAmount] = useState<string>('');
  const [adjDescription, setAdjDescription] = useState<string>('');

  const activeDebts = useMemo(() => debts.filter(d => !d.archived && (d.balance || 0) > 0), [debts]);

  const loadPlanData = useCallback(async () => {
    try {
      setIsLoading(true);
      const fetchedSettings = await DebtService.getPlanSettings();
      
      const fetchedAdjustments: Record<string, PlannedAdjustment[]> = {};
      await Promise.all(
        debts.map(async (d) => {
          const adjs = await DebtService.getPlannedAdjustments(d.id);
          fetchedAdjustments[d.id] = adjs;
        })
      );
      
      setSettings(fetchedSettings);
      setAdjustments(fetchedAdjustments);
      
      // Auto prefill debt target if none selected
      if (debts.length > 0 && !adjDebtId) {
        setAdjDebtId(debts[0].id);
      }
    } catch (e) {
      console.error("Failed to load plan data", e);
      toast({
        title: "Error loading plan",
        description: "Could not fetch planning preferences and adjustments.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [debts, adjDebtId, toast]);

  useEffect(() => {
    if (debts.length > 0) {
      loadPlanData();
    }
  }, [debts.length, loadPlanData]);

  // Priority list for sorting (Custom Strategy)
  const sortedCustomDebts = useMemo(() => {
    const list = [...activeDebts];
    const order = settings.customPriorityOrder || [];
    list.sort((a, b) => {
      const idxA = order.indexOf(a.id);
      const idxB = order.indexOf(b.id);
      const posA = idxA === -1 ? 9999 : idxA;
      const posB = idxB === -1 ? 9999 : idxB;
      return posA - posB;
    });
    return list;
  }, [activeDebts, settings.customPriorityOrder]);

  const handleMovePriority = async (index: number, direction: 'up' | 'down') => {
    const list = [...sortedCustomDebts];
    if (direction === 'up' && index > 0) {
      const temp = list[index];
      list[index] = list[index - 1];
      list[index - 1] = temp;
    } else if (direction === 'down' && index < list.length - 1) {
      const temp = list[index];
      list[index] = list[index + 1];
      list[index + 1] = temp;
    }
    
    const newOrder = list.map(d => d.id);
    const updatedSettings = {
      ...settings,
      customPriorityOrder: newOrder
    };
    
    setSettings(updatedSettings);
    await DebtService.savePlanSettings(updatedSettings);
  };

  const handleSaveSettings = async (field: keyof DebtPlanSettings, value: any) => {
    const updatedSettings = {
      ...settings,
      [field]: value
    };
    setSettings(updatedSettings);
    try {
      await DebtService.savePlanSettings(updatedSettings);
    } catch (e) {
      console.error("Failed to save plan settings", e);
    }
  };

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjTargetMonth || !adjDebtId || !adjAmount || !adjDescription) {
      toast({
        title: "Validation Error",
        description: "Please fill out all adjustment fields.",
        variant: "destructive"
      });
      return;
    }

    const numAmount = parseFloat(adjAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast({
        title: "Validation Error",
        description: "Adjustment amount must be a positive number.",
        variant: "destructive"
      });
      return;
    }

    // A windfall reduces the balance, so it is stored as a negative number in our calculation loop
    const storedAmount = adjType === 'windfall' ? -numAmount : numAmount;

    setIsSaving(true);
    try {
      const newAdj = await DebtService.addPlannedAdjustment(adjDebtId, {
        month: adjTargetMonth,
        amount: storedAmount,
        type: adjType,
        description: adjDescription
      });

      setAdjustments(prev => ({
        ...prev,
        [adjDebtId]: [...(prev[adjDebtId] || []), newAdj]
      }));

      toast({
        title: "Adjustment Added",
        description: "The payment simulation has been updated."
      });

      // Reset form fields
      setAdjAmount('');
      setAdjDescription('');
    } catch (e) {
      console.error("Failed to add adjustment", e);
      toast({
        title: "Error",
        description: "Failed to save adjustment in database.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAdjustment = async (debtId: string, adjId: string) => {
    try {
      await DebtService.deletePlannedAdjustment(debtId, adjId);
      setAdjustments(prev => ({
        ...prev,
        [debtId]: (prev[debtId] || []).filter(a => a.id !== adjId)
      }));
      toast({
        title: "Adjustment Deleted",
        description: "The payment simulation has been updated."
      });
    } catch (e) {
      console.error("Failed to delete adjustment", e);
      toast({
        title: "Error",
        description: "Failed to delete adjustment from database.",
        variant: "destructive"
      });
    }
  };

  // Compile calculations
  const schedule = useMemo(() => {
    return calculatePayoffSchedule(debts, settings, adjustments, month);
  }, [debts, settings, adjustments, month]);

  const totalMinimumPayment = useMemo(() => {
    return activeDebts.reduce((sum, d) => sum + (d.minimumPayment || 0), 0);
  }, [activeDebts]);

  // Strategy comparison calculations
  const avalancheSchedule = useMemo(() => {
    const s = { ...settings, strategy: 'avalanche' as const };
    return calculatePayoffSchedule(debts, s, adjustments, month);
  }, [debts, adjustments, month, settings]);

  const snowballSchedule = useMemo(() => {
    const s = { ...settings, strategy: 'snowball' as const };
    return calculatePayoffSchedule(debts, s, adjustments, month);
  }, [debts, adjustments, month, settings]);

  const strategyStats = useMemo(() => {
    const avMonths = avalancheSchedule.length;
    const avInterest = avalancheSchedule.reduce((sum, entry) => sum + entry.totalInterest, 0);
    const sbMonths = snowballSchedule.length;
    const sbInterest = snowballSchedule.reduce((sum, entry) => sum + entry.totalInterest, 0);

    return {
      avalanche: { months: avMonths, interest: avInterest },
      snowball: { months: sbMonths, interest: sbInterest }
    };
  }, [avalancheSchedule, snowballSchedule]);

  const currentPlanStats = useMemo(() => {
    const totalInterest = schedule.reduce((sum, entry) => sum + entry.totalInterest, 0);
    const months = schedule.length;
    return { months, totalInterest };
  }, [schedule]);

  const handleApplySchedule = async () => {
    if (schedule.length === 0) return;
    setIsSaving(true);
    try {
      const firstMonthPayments = schedule[0].payments;
      const nextMonth = format(addMonths(parse(month + '-01', 'yyyy-MM-dd', new Date()), 1), 'yyyy-MM');
      await DebtService.applyPaymentsToBudget(nextMonth, firstMonthPayments);
      onRefresh();
      toast({
        title: "Success!",
        description: `Plan applied. Next month's (${nextMonth}) minimum payments have been updated on the Debt Worksheet.`,
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Error Applying Plan",
        description: e.message || "Could not apply the plan.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleMonthExpanded = (m: number) => {
    setExpandedMonths(prev => ({
      ...prev,
      [m]: !prev[m]
    }));
  };

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mr-2" />
        <span>Loading simulation planner...</span>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Comparison Dashboard & Strategy Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-primary/20 shadow-md bg-gradient-to-br from-primary/5 via-card to-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-semibold">Payoff Summary</CardDescription>
            <CardTitle className="text-2xl font-black text-primary font-headline">
              {currentPlanStats.months > 0 ? `${currentPlanStats.months} Months` : 'No Active Debt'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {currentPlanStats.months > 0 ? (
              <p>Projected to be debt-free by <span className="font-semibold text-foreground">{format(addMonths(parse(month + '-01', 'yyyy-MM-dd', new Date()), currentPlanStats.months - 1), 'MMMM yyyy')}</span>.</p>
            ) : (
              <p>All listed accounts are paid off!</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-emerald-500/20 shadow-md bg-gradient-to-br from-emerald-500/5 via-card to-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-semibold">Total Cost of Debt</CardDescription>
            <CardTitle className="text-2xl font-black text-emerald-600 font-headline">
              {formatCurrency(currentPlanStats.totalInterest)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Accrued interest across all accounts throughout the payoff timeline.</p>
          </CardContent>
        </Card>

        <Card className="border-indigo-500/20 shadow-md bg-gradient-to-br from-indigo-500/5 via-card to-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-wider font-semibold">Strategy Comparison</CardDescription>
            <CardTitle className="text-md font-bold text-indigo-600 flex items-center gap-1">
              <Sparkles className="h-4 w-4" />
              Avalanche vs. Snowball
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1.5 pt-1 text-muted-foreground">
            <div className="flex justify-between">
              <span>Avalanche (Interest):</span>
              <span className="font-semibold text-foreground">{strategyStats.avalanche.months} mo | {formatCurrency(strategyStats.avalanche.interest)}</span>
            </div>
            <div className="flex justify-between">
              <span>Snowball (Balances):</span>
              <span className="font-semibold text-foreground">{strategyStats.snowball.months} mo | {formatCurrency(strategyStats.snowball.interest)}</span>
            </div>
            {strategyStats.avalanche.interest < strategyStats.snowball.interest && (
              <p className="text-[10px] text-emerald-600 font-medium pt-1">
                ★ Avalanche saves you {formatCurrency(strategyStats.snowball.interest - strategyStats.avalanche.interest)} in interest!
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 2. Strategy Settings Card */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Calculator className="h-5 w-5 text-primary" />
            Simulation & Strategy Settings
          </CardTitle>
          <CardDescription>
            Adjust your monthly payments and select your payoff strategy to recalculate projections instantly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="total-payment" className="font-medium text-sm">Total Monthly Debt Payment</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                <Input
                  id="total-payment"
                  type="number"
                  className="pl-7"
                  value={settings.totalMonthlyPayment || ''}
                  onChange={(e) => handleSaveSettings('totalMonthlyPayment', parseFloat(e.target.value) || 0)}
                  placeholder={totalMinimumPayment.toString()}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Minimum required sum is {formatCurrency(totalMinimumPayment)}. Payments roll over as accounts are paid off.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="strategy-select" className="font-medium text-sm">Payoff Priority Strategy</Label>
              <Select
                value={settings.strategy}
                onValueChange={(val) => handleSaveSettings('strategy', val)}
              >
                <SelectTrigger id="strategy-select">
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avalanche">Avalanche (Highest Interest First)</SelectItem>
                  <SelectItem value="snowball">Snowball (Lowest Balance First)</SelectItem>
                  <SelectItem value="custom">Custom Order (Set priority below)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {settings.strategy === 'custom' && (
              <div className="space-y-2 col-span-1 md:col-span-2 lg:col-span-1">
                <Label className="font-medium text-sm">Set Priority (Up-Down)</Label>
                <div className="border rounded-md p-2 space-y-1 bg-secondary/10 max-h-[140px] overflow-y-auto">
                  {sortedCustomDebts.map((d, idx) => (
                    <div key={d.id} className="flex justify-between items-center bg-card border px-2.5 py-1.5 rounded text-xs">
                      <span className="font-medium truncate max-w-[120px]">{d.name}</span>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0"
                          disabled={idx === 0}
                          onClick={() => handleMovePriority(idx, 'up')}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 p-0"
                          disabled={idx === sortedCustomDebts.length - 1}
                          onClick={() => handleMovePriority(idx, 'down')}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
        {schedule.length > 0 && (
          <CardFooter className="bg-secondary/10 flex justify-between items-center py-3.5 border-t">
            <span className="text-xs text-muted-foreground font-medium">
              Want to lock in these payment targets for your monthly budget worksheet?
            </span>
            <Button onClick={handleApplySchedule} disabled={isSaving} size="sm">
              {isSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Apply First Month Targets to Next Month
            </Button>
          </CardFooter>
        )}
      </Card>

      {/* 3. Add Planned Override Form */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Schedule planned Charges, Fees, or Windfalls
          </CardTitle>
          <CardDescription>
            Add one-time future adjustments (e.g. purchases, annual fees, tax windfalls) to see how they impact your entire multiyear plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddAdjustment} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="adj-month" className="text-xs">Target Month</Label>
              <Input
                id="adj-month"
                type="month"
                required
                value={adjTargetMonth}
                onChange={(e) => setAdjTargetMonth(e.target.value)}
                min={month}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adj-debt" className="text-xs">Account</Label>
              <Select value={adjDebtId} onValueChange={setAdjDebtId}>
                <SelectTrigger id="adj-debt">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {debts.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adj-type" className="text-xs">Type</Label>
              <Select value={adjType} onValueChange={(val: any) => setAdjType(val)}>
                <SelectTrigger id="adj-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="charge">Purchase / Charge (+)</SelectItem>
                  <SelectItem value="fee">Monthly / Annual Fee (+)</SelectItem>
                  <SelectItem value="windfall">Windfall / Extra Payment (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="adj-desc" className="text-xs">Description</Label>
              <Input
                id="adj-desc"
                type="text"
                required
                placeholder="e.g., Annual Subscription"
                value={adjDescription}
                onChange={(e) => setAdjDescription(e.target.value)}
              />
            </div>

            <div className="flex gap-2 w-full">
              <div className="space-y-1.5 flex-1">
                <Label htmlFor="adj-amount" className="text-xs">Amount</Label>
                <Input
                  id="adj-amount"
                  type="number"
                  step="0.01"
                  required
                  placeholder="$0.00"
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={isSaving} className="h-10 px-3">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 4. Payoff Projections Interactive Timeline */}
      {schedule.length > 0 && (
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Repayment Projection Timeline</CardTitle>
            <CardDescription>
              Expand any projected month to inspect detailed balances, compounding interest details, and edit future overrides.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {schedule.map((entry) => {
                const isExpanded = !!expandedMonths[entry.month];
                const d = parse(entry.monthString + '-01', 'yyyy-MM-dd', new Date());
                const monthName = format(d, 'MMMM yyyy');

                // Gather overrides for this month
                const monthOverridingAdjustments: { debtId: string; debtName: string; adj: PlannedAdjustment }[] = [];
                activeDebts.forEach(debt => {
                  const adjs = adjustments[debt.id] || [];
                  adjs.filter(a => a.month === entry.monthString).forEach(a => {
                    monthOverridingAdjustments.push({ debtId: debt.id, debtName: debt.name, adj: a });
                  });
                });

                return (
                  <div key={entry.month} className="border rounded-lg overflow-hidden bg-card/40 transition-colors hover:bg-card/60">
                    {/* Collapsible Header */}
                    <div
                      onClick={() => toggleMonthExpanded(entry.month)}
                      className="flex justify-between items-center px-4 py-3 cursor-pointer select-none bg-secondary/10"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-primary font-headline">Month {entry.month}</span>
                        <Badge variant="outline" className="text-xs py-0.5">{monthName}</Badge>
                        {monthOverridingAdjustments.length > 0 && (
                          <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[10px]">
                            {monthOverridingAdjustments.length} override{monthOverridingAdjustments.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs font-medium">
                        <div className="text-right">
                          <span className="text-muted-foreground">Total Paid: </span>
                          <span className="font-bold text-foreground">{formatCurrency(entry.totalPaid)}</span>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>

                    {/* Detailed Breakdown */}
                    {isExpanded && (
                      <div className="p-0 border-t bg-card/20">
                        <div className="overflow-x-auto">
                          <Table className="text-xs">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-[150px]">Debt Name</TableHead>
                                <TableHead className="text-right">Start Balance</TableHead>
                                <TableHead className="text-right">Interest Charged</TableHead>
                                <TableHead className="text-right">Planned Overrides</TableHead>
                                <TableHead className="text-right font-semibold">Payment Allocation</TableHead>
                                <TableHead className="text-right">End Balance</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {activeDebts.map(debt => {
                                const details = entry.details[debt.id];
                                if (!details) return null;
                                
                                const isPaidOffThisMonth = details.endingBalance <= 0 && details.startingBalance > 0;

                                return (
                                  <TableRow key={debt.id} className={details.endingBalance <= 0 ? "bg-emerald-500/5" : ""}>
                                    <TableCell className="font-medium">
                                      {debt.name}
                                      {isPaidOffThisMonth && (
                                        <Badge className="ml-2 bg-emerald-600 text-white border-0 text-[9px] px-1 py-0 font-bold uppercase">
                                          Paid Off
                                        </Badge>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right text-muted-foreground">
                                      {formatCurrency(details.startingBalance)}
                                    </TableCell>
                                    <TableCell className="text-right text-destructive">
                                      {details.interestAccrued > 0 ? `+${formatCurrency(details.interestAccrued)}` : '—'}
                                    </TableCell>
                                    <TableCell className="text-right font-medium text-indigo-600">
                                      {details.adjustmentApplied !== 0 ? (
                                        details.adjustmentApplied > 0 ? `+${formatCurrency(details.adjustmentApplied)}` : `-${formatCurrency(Math.abs(details.adjustmentApplied))}`
                                      ) : '—'}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-emerald-600">
                                      {details.paymentAmount > 0 ? `-${formatCurrency(details.paymentAmount)}` : '—'}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold">
                                      {details.endingBalance > 0 ? formatCurrency(details.endingBalance) : (
                                        <span className="text-emerald-600 font-bold">Paid Off</span>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>

                        {/* List Planned Overrides in this month to Delete them */}
                        {monthOverridingAdjustments.length > 0 && (
                          <div className="p-3 bg-indigo-500/5 border-t border-indigo-500/10 text-xs">
                            <span className="font-semibold text-indigo-600 uppercase tracking-wider text-[10px] block mb-1">
                              Active overrides for this month:
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {monthOverridingAdjustments.map(({ debtId, debtName, adj }) => (
                                <div key={adj.id} className="flex items-center gap-1.5 bg-card border border-indigo-500/20 px-2.5 py-1 rounded text-xs shadow-sm">
                                  <span className="font-bold text-indigo-600">{debtName}:</span>
                                  <span>{adj.description}</span>
                                  <span className="font-semibold text-foreground">
                                    ({adj.amount > 0 ? `+` : ''}{formatCurrency(adj.amount)})
                                  </span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDeleteAdjustment(debtId, adj.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
