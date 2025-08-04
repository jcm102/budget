'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CategoryManager } from '@/components/category-manager';
import { ArrowLeft } from 'lucide-react';
import { TransfereeManager } from '@/components/transferee-manager';

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
          <CategoryManager />
        </div>
        <div>
          <TransfereeManager />
        </div>
      </main>
    </div>
  );
}
