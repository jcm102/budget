
'use client';

import { useState, useEffect } from 'react';
import { format, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DatePicker } from '@/components/date-picker';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { getTransactionsByDateRange } from '@/services/monthly-budget-service';
import type { Transaction, AccountDetails } from '@/types';
import { useAccountDetails } from '@/hooks/use-transferees';
import { Loader2, TrendingUp, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import React from 'react';


const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

type ReportData = {
  cardName: string;
  cardId: string;
  total: number;
};

type GroupedTransactions = Record<string, Transaction[]>;

const LAST_REPORT_DATE_KEY = 'creditCardReport_lastRunDate';

export function CreditCardReport() {
  const [startDate, setStartDate] = useState<Date | undefined>(() => {
    if (typeof window !== 'undefined') {
      const lastRunDate = localStorage.getItem(LAST_REPORT_DATE_KEY);
      return lastRunDate ? new Date(lastRunDate) : startOfWeek(new Date());
    }
    return startOfWeek(new Date());
  });
  const [endDate, setEndDate] = useState<Date | undefined>(() => endOfWeek(new Date()));
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [groupedTransactions, setGroupedTransactions] = useState<GroupedTransactions>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const { accounts, isLoading: isLoadingAccounts } = useAccountDetails();

  const creditCardAccounts = accounts.filter(acc => acc.type === 'Credit');

  const handleGenerateReport = async () => {
    if (!startDate || !endDate) return;

    setIsLoading(true);
    setReportData([]);
    setGroupedTransactions({});
    try {
      const transactions = await getTransactionsByDateRange(startDate, endDate);
      
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
      
      setGroupedTransactions(transactionsByCard);

      const formattedReport = Array.from(totalsByCard.entries()).map(([cardId, total]) => ({
        cardId,
        cardName: accounts.find(acc => acc.id === cardId)?.name || 'Unknown Card',
        total,
      }));

      setReportData(formattedReport);

      localStorage.setItem(LAST_REPORT_DATE_KEY, endDate.toISOString());

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
          Generate a summary of credit card spending within a specific date range to determine payoff amounts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="grid gap-2 flex-1">
            <label htmlFor="start-date" className="text-sm font-medium">Start Date</label>
            <DatePicker date={startDate} setDate={setStartDate} />
          </div>
          <div className="grid gap-2 flex-1">
            <label htmlFor="end-date" className="text-sm font-medium">End Date</label>
            <DatePicker date={endDate} setDate={setEndDate} />
          </div>
        </div>
         <div className="flex items-center space-x-2 pt-2">
            <Checkbox id="show-transactions" checked={showTransactions} onCheckedChange={(checked) => setShowTransactions(!!checked)} />
            <Label htmlFor="show-transactions">Show transaction list</Label>
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
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead>Credit Card</TableHead>
                            <TableHead className="text-right">Amount to Pay</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <>
                                <TableRow><TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                                <TableRow><TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell></TableRow>
                            </>
                        ) : reportData.length > 0 ? (
                           reportData.map(item => (
                               <Collapsible key={item.cardId} asChild>
                                    <React.Fragment>
                                        <TableRow>
                                            <TableCell>
                                                {showTransactions && groupedTransactions[item.cardId] && (
                                                    <CollapsibleTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                             <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:-rotate-180" />
                                                        </Button>
                                                    </CollapsibleTrigger>
                                                )}
                                            </TableCell>
                                            <TableCell className="font-medium">{item.cardName}</TableCell>
                                            <TableCell className="text-right font-mono">{formatCurrency(item.total)}</TableCell>
                                        </TableRow>
                                        {showTransactions && groupedTransactions[item.cardId] && (
                                           <CollapsibleContent asChild>
                                                <tr>
                                                    <td colSpan={3} className="p-0">
                                                        <div className="p-4 bg-muted/50">
                                                            <h4 className="font-semibold mb-2 pl-4">Transactions</h4>
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead className="w-[120px]">Date</TableHead>
                                                                        <TableHead>Description</TableHead>
                                                                        <TableHead className="text-right">Amount</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {groupedTransactions[item.cardId].map(tx => (
                                                                        <TableRow key={tx.id} className="hover:bg-background/50">
                                                                            <TableCell>{format(new Date(tx.date), 'PPP')}</TableCell>
                                                                            <TableCell>{tx.description}</TableCell>
                                                                            <TableCell className="text-right">{formatCurrency(tx.amount)}</TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </td>
                                                </tr>
                                           </CollapsibleContent>
                                        )}
                                    </React.Fragment>
                               </Collapsible>
                           ))
                        ) : null}
                    </TableBody>
                    {reportData.length > 0 && (
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={2} className="font-bold text-right">Grand Total</TableCell>
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
