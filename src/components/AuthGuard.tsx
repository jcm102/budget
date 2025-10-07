
'use client';

import { useUser } from '@/firebase';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isUserLoading) {
      return; // Do nothing while loading
    }
    
    if (user && pathname === '/login') {
      const redirectPath = isMobile ? '/monthly-budget/add' : '/tasks';
      router.replace(redirectPath);
    } else if (!user && pathname !== '/login') {
      router.replace('/login');
    }

  }, [user, isUserLoading, router, pathname, isMobile]);

  if (isUserLoading || (!user && pathname !== '/login') || (user && pathname === '/login')) {
     return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
