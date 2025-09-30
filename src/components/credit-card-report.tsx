
'use client';

import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/date-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { getTransactionsByDateRange } from '@/services/monthly-budget-service';
import { getCreditCardReportLastRunDate, updateCreditCardReportLastRunDate } from '@/services/settings-service';
import type { Transaction, AccountDetails } from '@/types';
import { useAccountDetails } from '@/hooks/use-transferees';
import { Loader2, TrendingUp, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

type ReportData = {
  cardName: string;
  cardId: string;
  total: number;
};

type GroupedTransactions = {
  [key: string]: Transaction[];
}

export function CreditCardReport() {
  const { toast } = useToast();
  const [startDate, setStartDate] = useState<string | undefined>();
  const [endDate, setEndDate] = useState<string | undefined>(() => new Date().toISOString().slice(0, 10));
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [groupedTransactions, setGroupedTransactions] = useState<GroupedTransactions>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const { accounts } = useAccountDetails();
  const [openCollapsibles, setOpenCollapsibles] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadLastRunDate = async () => {
        try {
            const lastRunDateString = await getCreditCardReportLastRunDate();
            if (lastRunDateString) {
                // To reliably get the next day, parse the string as UTC
                const utcDate = new Date(`${lastRunDateString}T00:00:00Z`);
                // Add a day
                utcDate.setUTCDate(utcDate.getUTCDate() + 1);
                // Format back to YYYY-MM-DD
                const nextYear = utcDate.getUTCFullYear();
                const nextMonth = (utcDate.getUTCMonth() + 1).toString().padStart(2, '0');
                const nextDay = utcDate.getUTCDate().toString().padStart(2, '0');
                
                setStartDate(`${nextYear}-${nextMonth}-${nextDay}`);

            } else {
                const today = new Date();
                const startOfWeekDate = new Date(today.setDate(today.getDate() - today.getDay()));
                setStartDate(startOfWeekDate.toISOString().slice(0, 10));
            }
        } catch (error) {
            console.error("Failed to fetch last run date", error);
            const today = new Date();
            const startOfWeekDate = new Date(today.setDate(today.getDate() - today.getDay()));
            setStartDate(startOfWeekDate.toISOString().slice(0, 10)); // fallback
        }
    };
    loadLastRunDate();
  }, []);

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) return;
    
    if (startDate > endDate) {
        toast({
            title: 'Invalid Date Range',
            description: 'The start date cannot be after the end date.',
            variant: 'destructive',
        });
        return;
    }
    
    // Create Date objects from strings, assuming UTC to avoid timezone shifts
    const queryStartDate = new Date(startDate + 'T00:00:00Z');
    const queryEndDate = new Date(endDate + 'T23:59:59Z');

    setIsLoading(true);
    setReportData([]);
    setGroupedTransactions({});
    try {
      const transactions = await getTransactionsByDateRange(queryStartDate, queryEndDate);
      
      const totalsByCard = new Map<string, number>();
      const transactionsByCard: GroupedTransactions = {};

      transactions.forEach(tx => {
        const sourceAccount = accounts.find(acc => acc.id === tx.sourceAccountId);
        if (sourceAccount && sourceAccount.type === 'Credit') {
            const cardId = tx.sourceAccountId;
            const currentTotal = totalsByCard.get(cardId) || 0;
            totalsByCard.set(cardId, currentTotal + tx.amount);

            if (!transactionsByCard[cardId]) {
              transactionsByCard[cardId] = [];
            }
            transactionsByCard[cardId].push(tx);
        }
      });
      
      const formattedReport = Array.from(totalsByCard.entries()).map(([cardId, total]) => ({
        cardId,
        cardName: accounts.find(acc => acc.id === cardId)?.name || 'Unknown Card',
        total,
      })).sort((a, b) => a.cardName.localeCompare(b.cardName));

      setReportData(formattedReport);
      if (showTransactions) {
        setGroupedTransactions(transactionsByCard);
      }
      
      await updateCreditCardReportLastRunDate(endDate);

    } catch (error) {
      console.error("Failed to generate report:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const grandTotal = reportData.reduce((sum, item) => sum + item.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <TrendingUp />
            Credit Card Payoff Report
        </CardTitle>
        <CardDescription>
          Generate a summary of credit card spending within a specific date range to determine payoff amounts. The start date defaults to the day after the last report was run.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="grid gap-2 flex-1">
            <Label htmlFor="start-date">Start Date</Label>
            <DatePicker date={startDate} setDate={setStartDate} />
          </div>
          <div className="grid gap-2 flex-1">
            <Label htmlFor="end-date">End Date</Label>
            <DatePicker date={endDate} setDate={setEndDate} />
          </div>
        </div>
        <div className="flex items-center space-x-2">
            <Checkbox id="show-transactions" checked={showTransactions} onCheckedChange={(checked) => setShowTransactions(!!checked)} />
            <Label htmlFor="show-transactions">Show individual transactions</Label>
        </div>
        <Button onClick={handleGenerateReport} disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Generate Report
        </Button>
      </CardContent>
      
      {(isLoading || reportData.length > 0) && (
        <CardFooter className="flex-col items-start">
             <h3 className="text-lg font-medium mb-4">Report Results</h3>
            <div className="w-full rounded-lg border bg-card text-card-foreground shadow-sm">
                 <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Credit Card</TableHead>
                            <TableHead className="text-right">Amount to Pay</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <>
                                <TableRow><TableCell colSpan={2}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                                <TableRow><TableCell colSpan={2}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                            </>
                        ) : reportData.length > 0 ? (
                           reportData.map(item => (
                             <Collapsible key={item.cardId} asChild>
                                <>
                                  <TableRow>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        {showTransactions && groupedTransactions[item.cardId] && (
                                          <CollapsibleTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-6 w-6 -ml-2">
                                              <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:-rotate-180" />
                                            </Button>
                                          </CollapsibleTrigger>
                                        )}
                                        <span className={cn(!showTransactions || !groupedTransactions[item.cardId] && "pl-8")}>{item.cardName}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(item.total)}</TableCell>
                                  </TableRow>
                                  {showTransactions && groupedTransactions[item.cardId] && (
                                    <CollapsibleContent asChild>
                                      <TableRow>
                                        <TableCell colSpan={2} className="p-0">
                                          <div className="p-4 bg-muted/50">
                                            <Table>
                                              <TableHeader>
                                                <TableRow>
                                                  <TableHead>Date</TableHead>
                                                  <TableHead>Description</TableHead>
                                                  <TableHead className="text-right">Amount</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {groupedTransactions[item.cardId]?.map(tx => (
                                                  <TableRow key={tx.id}>
                                                    <TableCell>{format(parseISO(tx.date), 'PPP')}</TableCell>
                                                    <TableCell>{tx.description}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell>
                                                  </TableRow>
                                                ))}
                                              </TableBody>
                                            </Table>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    </CollapsibleContent>
                                  )}
                                </>
                             </Collapsible>
                           ))
                        ) : null}
                    </TableBody>
                    {reportData.length > 0 && (
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={1} className="font-bold text-right">Grand Total</TableCell>
                                <TableCell className="text-right font-bold font-mono">{formatCurrency(grandTotal)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    )}
                </Table>
            </div>
             {reportData.length === 0 && !isLoading && (
                <p className="text-center text-muted-foreground w-full p-8">No credit card transactions found for the selected date range.</p>
             )}
        </CardFooter>
      )}
    </Card>
  );
}
