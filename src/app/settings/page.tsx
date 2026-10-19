'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { IncomeCategoryManager } from '@/components/income-category-manager';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { AccountDetailsManager } from '@/components/transferee-manager';
import { MileageRateManager } from '@/components/mileage-rate-manager';
import { WorkCategoryManager } from '@/components/work-category-manager';
import { PersonManager } from '@/components/person-manager';
import { ExchangeRateManager } from '@/components/exchange-rate-manager';
import { AccountManager } from '@/components/account-manager';
import { BudgetCategoryManager } from '@/components/budget-category-manager';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CommonlyUsedAccountsManager } from '@/components/commonly-used-accounts-manager';
import { ChangePasswordForm } from '@/components/change-password-form';
import { SinkingFundCategoryManager } from '@/components/sinking-fund-category-manager';
import { PayeeManager } from '@/components/payee-manager';
import { BackupManager } from '@/components/backup-manager';

function SettingsContent() {
  const searchParams = useSearchParams();
  const requestedTab = searchParams?.get('tab');
  const [activeTab, setActiveTab] = useState('accounts');

  useEffect(() => {
    if (requestedTab) {
      setActiveTab(requestedTab);
    }
  }, [requestedTab]);

  return (
    <div className="container mx-auto max-w-4xl p-4 md:p-8">
      <header className="mb-8 flex items-center justify-between">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </header>
      <main className="space-y-8">
        <div>
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold font-headline text-primary">Settings</h1>
            {activeTab !== 'backup' && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setActiveTab('backup')}
                className="border-amber-500/40 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
              >
                <Sparkles className="mr-1.5 h-4 w-4" />
                Fresh Start & Backups
              </Button>
            )}
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto p-1 gap-1">
              <TabsTrigger value="accounts" className="py-2 text-xs sm:text-sm">Accounts</TabsTrigger>
              <TabsTrigger value="categories" className="py-2 text-xs sm:text-sm">Categories</TabsTrigger>
              <TabsTrigger value="general" className="py-2 text-xs sm:text-sm">General</TabsTrigger>
              <TabsTrigger value="rates" className="py-2 text-xs sm:text-sm">Rates</TabsTrigger>
              <TabsTrigger value="security" className="py-2 text-xs sm:text-sm">Security</TabsTrigger>
              <TabsTrigger value="backup" className="py-2 text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400">
                Backup & Reset
              </TabsTrigger>
            </TabsList>

            <TabsContent value="accounts" className="mt-6">
              <div className="space-y-4">
                <AccountManager />
                <AccountDetailsManager />
                <CommonlyUsedAccountsManager />
              </div>
            </TabsContent>

            <TabsContent value="categories" className="mt-6">
              <div className="space-y-4">
                <BudgetCategoryManager />
                <IncomeCategoryManager />
                <WorkCategoryManager />
                <SinkingFundCategoryManager />
              </div>
            </TabsContent>

            <TabsContent value="general" className="mt-6">
              <div className="space-y-4">
                <PersonManager />
                <PayeeManager />
              </div>
            </TabsContent>

            <TabsContent value="rates" className="mt-6">
              <div className="space-y-4">
                <MileageRateManager />
                <ExchangeRateManager />
              </div>
            </TabsContent>

            <TabsContent value="security" className="mt-6">
              <div className="space-y-4">
                <ChangePasswordForm />
              </div>
            </TabsContent>

            <TabsContent value="backup" className="mt-6">
              <BackupManager />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="container mx-auto max-w-4xl p-8">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
