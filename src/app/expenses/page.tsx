
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Landmark, HandCoins, DollarSign, FileClock, Archive, FileText, Route, Car } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useExpenses } from '@/hooks/use-expenses';
import { useAccountLedger } from '@/hooks/use-account-ledger';
import { ExpenseTable } from '@/components/expense-table';
import { MileageTable } from '@/components/mileage-table';
import { HonorariumTable } from '@/components/honorarium-table';
import * as ExpenseService from '@/services/expense-service';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function ExpensesPage() {
    const { ledgerItems, isLoading: isLoadingLedger, fetchItems: fetchLedgerItems } = useAccountLedger();
    const {
        expenses,
        mileageLogs,
        honorariums,
        addExpense,
        updateExpense,
        deleteExpense,
        toggleExpenseCompleted,
        addMileage,
        updateMileage,
        deleteMileage,
        addHonorarium,
        updateHonorarium,
        deleteHonorarium,
        isLoading,
        fetchData,
    } = useExpenses();
    
    const { toast } = useToast();
    const [archivedMonths, setArchivedMonths] = useState<string[]>([]);
    const [selectedArchive, setSelectedArchive] = useState<string | null>(null);
    const [archivedData, setArchivedData] = useState<{ expenses: any[], mileageLogs: any[], honorariums: any[] } | null>(null);

     useEffect(() => {
        const fetchMonths = async () => {
            const months = await ExpenseService.getArchivedMonths();
            setArchivedMonths(months);
            if (months.length > 0 && !selectedArchive) {
                setSelectedArchive(months[0]);
            }
        };
        fetchMonths();
    }, []);

    useEffect(() => {
        if (selectedArchive) {
            const fetchArchiveData = async () => {
                const data = await ExpenseService.getExpensesForMonth(selectedArchive);
                setArchivedData(data);
            };
            fetchArchiveData();
        }
    }, [selectedArchive]);

    const handleArchive = async () => {
        const now = new Date();
        const archiveKey = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        try {
            await ExpenseService.archiveCurrentExpenses(archiveKey);
            await fetchData();
            const months = await ExpenseService.getArchivedMonths();
            setArchivedMonths(months);
            setSelectedArchive(archiveKey);
            toast({
                title: 'Success!',
                description: 'Current expenses have been archived.',
            });
        } catch (error: any) {
            toast({
                title: 'Error Archiving',
                description: error.message || 'Could not archive expenses.',
                variant: 'destructive',
            });
        }
    };

    const handleAddExpense = (item: any, ledgerAccountId: any, callback: any) => {
        addExpense(item, ledgerAccountId, (success) => {
            if (success && ledgerAccountId) {
                fetchLedgerItems();
            }
            callback(success);
        });
    };

    const handleAddHonorarium = (item: any) => {
        addHonorarium(item).then(() => {
            fetchLedgerItems();
        }).catch(() => {
            // Error is already toasted in the hook
        });
    };

    const handleDeleteHonorarium = (id: string) => {
        deleteHonorarium(id).then(() => {
            fetchLedgerItems();
        }).catch(() => {
            // Error is already toasted in the hook
        });
    };
    
    const reimbursableFund = ledgerItems.find(item => item.name === 'Reimbursable Fund');
    const honorariumFund = ledgerItems.find(item => item.name === 'Honorarium Fund');
    const totalReimbursable = expenses.filter(e => e.reimbursable).reduce((acc, e) => acc + e.amount, 0);

    const renderSummarySkeleton = () => (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 border rounded-lg bg-card">
            <Skeleton className="h-5 w-24 mb-2" />
            <Skeleton className="h-7 w-32" />
          </div>
        ))
    );
    
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    };

    return (
        <div className="container mx-auto max-w-7xl p-4 md:p-8">
            <header className="mb-8 flex justify-between items-center no-print">
                <Button asChild variant="outline">
                <Link href="/">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Home
                </Link>
                </Button>
                 <div className="flex items-center gap-2">
                    <Button onClick={handleArchive} variant="outline" disabled={expenses.length === 0 && mileageLogs.length === 0 && honorariums.length === 0}>
                        <Archive className="mr-2 h-4 w-4" />
                        Archive Current Month
                    </Button>
                </div>
            </header>
            <main>
                <h1 className="text-3xl font-bold font-headline text-primary mb-6">Work Expenses</h1>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    {isLoading || isLoadingLedger ? renderSummarySkeleton() : (
                        <>
                            <div className="p-4 border rounded-lg bg-card">
                                <h4 className="text-muted-foreground flex items-center gap-2"><HandCoins className="h-4 w-4"/>Honorarium Fund</h4>
                                <p className="text-2xl font-semibold">{formatCurrency(honorariumFund?.amount || 0)}</p>
                            </div>
                            <div className="p-4 border rounded-lg bg-card">
                                <h4 className="text-muted-foreground flex items-center gap-2"><Landmark className="h-4 w-4"/>Reimbursable Fund</h4>
                                <p className="text-2xl font-semibold">{formatCurrency(reimbursableFund?.amount || 0)}</p>
                            </div>
                            <div className="p-4 border rounded-lg bg-card">
                                <h4 className="text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4"/>Reimbursable Expenses</h4>
                                <p className="text-2xl font-semibold">{formatCurrency(totalReimbursable)}</p>
                            </div>
                             <div className="p-4 border rounded-lg bg-card">
                                <h4 className="text-muted-foreground flex items-center gap-2"><Car className="h-4 w-4"/>Mileage Reimbursement</h4>
                                <p className="text-2xl font-semibold">{formatCurrency(mileageLogs.reduce((acc, log) => acc + (log.distance * log.rate), 0))}</p>
                            </div>
                        </>
                    )}
                </div>
                
                <Tabs defaultValue="expenses" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 bg-secondary/50 mb-6 no-print h-auto">
                        <TabsTrigger value="expenses" className="py-2"><FileText className="mr-2 h-4 w-4"/>Monetary Expenses</TabsTrigger>
                        <TabsTrigger value="mileage" className="py-2"><Route className="mr-2 h-4 w-4"/>Mileage</TabsTrigger>
                        <TabsTrigger value="honorariums" className="py-2"><HandCoins className="mr-2 h-4 w-4"/>Honorariums</TabsTrigger>
                        <TabsTrigger value="archive" className="py-2"><FileClock className="mr-2 h-4 w-4"/>Archived</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="expenses">
                        <ExpenseTable 
                            expenses={expenses}
                            addExpense={handleAddExpense}
                            updateExpense={updateExpense}
                            deleteExpense={deleteExpense}
                            toggleExpenseCompleted={toggleExpenseCompleted}
                            addMileage={addMileage}
                            updateMileage={updateMileage}
                            addHonorarium={handleAddHonorarium}
                            updateHonorarium={updateHonorarium}
                            isLoading={isLoading}
                            isArchived={false}
                        />
                    </TabsContent>
                    
                    <TabsContent value="mileage">
                         <MileageTable 
                            mileageLogs={mileageLogs}
                            addExpense={handleAddExpense}
                            updateExpense={updateExpense}
                            addMileage={addMileage}
                            updateMileage={updateMileage}
                            deleteMileage={deleteMileage}
                            addHonorarium={handleAddHonorarium}
                            updateHonorarium={updateHonorarium}
                            isLoading={isLoading}
                            isArchived={false}
                        />
                    </TabsContent>
                    
                    <TabsContent value="honorariums">
                        <HonorariumTable
                            honorariums={honorariums}
                            addExpense={handleAddExpense}
                            updateExpense={updateExpense}
                            addMileage={addMileage}
                            updateMileage={updateMileage}
                            addHonorarium={handleAddHonorarium}
                            updateHonorarium={updateHonorarium}
                            deleteHonorarium={handleDeleteHonorarium}
                            isLoading={isLoading}
                            isArchived={false}
                        />
                    </TabsContent>
                    <TabsContent value="archive">
                        <div className="space-y-6">
                            <h2 className="text-2xl font-bold font-headline text-primary">Archived Expenses</h2>
                            <div className="flex gap-2 flex-wrap">
                                {archivedMonths.map(month => (
                                    <Button key={month} variant={selectedArchive === month ? 'default' : 'outline'} onClick={() => setSelectedArchive(month)}>
                                        {month}
                                    </Button>
                                ))}
                                {archivedMonths.length === 0 && <p className="text-muted-foreground">No archives found.</p>}
                            </div>
                            {selectedArchive && archivedData && (
                                <div className="space-y-8">
                                     <div>
                                        <h3 className="text-xl font-semibold mb-4">Monetary Expenses</h3>
                                        <ExpenseTable expenses={archivedData.expenses} isLoading={false} isArchived={true} addExpense={()=>{}} updateExpense={()=>{}} deleteExpense={()=>{}} toggleExpenseCompleted={()=>{}} addMileage={()=>{}} updateMileage={()=>{}} addHonorarium={()=>{}} updateHonorarium={()=>{}} />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold mb-4">Mileage</h3>
                                        <MileageTable mileageLogs={archivedData.mileageLogs} isLoading={false} isArchived={true} addExpense={()=>{}} updateExpense={()=>{}} addMileage={()=>{}} updateMileage={()=>{}} deleteMileage={()=>{}} addHonorarium={()=>{}} updateHonorarium={()=>{}} />
                                    </div>
                                     <div>
                                        <h3 className="text-xl font-semibold mb-4">Honorariums</h3>
                                        <HonorariumTable honorariums={archivedData.honorariums} isLoading={false} isArchived={true} addExpense={()=>{}} updateExpense={()=>{}} addMileage={()=>{}} updateMileage={()=>{}} deleteHonorarium={()=>{}} addHonorarium={()=>{}} updateHonorarium={()=>{}} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
