

'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { IncomeCategoryManager } from '@/components/income-category-manager';
import { ArrowLeft } from 'lucide-react';
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

export default function SettingsPage() {
  return (
    <div className="container mx-auto max-w-2xl p-4 md:p-8">
      <header className="mb-8">
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </header>
      <main className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold font-headline text-primary mb-6">Settings</h1>
            <Tabs defaultValue="accounts" className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="accounts">Accounts</TabsTrigger>
                <TabsTrigger value="categories">Categories</TabsTrigger>
                <TabsTrigger value="general">General</TabsTrigger>
                <TabsTrigger value="rates">Rates</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
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
            </Tabs>
        </div>
      </main>
    </div>
  );
}
