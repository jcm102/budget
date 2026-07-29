
import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarHeader } from '@/components/ui/sidebar';
import { AppNav } from '@/components/app-nav';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthGuard } from '@/components/AuthGuard';
import { FloatingCalculator } from '@/components/floating-calculator';

export const metadata: Metadata = {
  title: 'TaskTrack Budget',
  description: 'Track your daily, weekly, and monthly budgeting tasks.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <AuthGuard>
            <SidebarProvider>
                <Sidebar>
                    <AppNav />
                </Sidebar>
                <SidebarInset className="flex flex-col">
                    <SidebarHeader>
                        <SidebarTrigger />
                    </SidebarHeader>
                    <div className="flex-1 overflow-y-auto">
                        {children}
                    </div>
                </SidebarInset>
            </SidebarProvider>
          </AuthGuard>
        </FirebaseClientProvider>
        <FloatingCalculator />
        <Toaster />
      </body>
    </html>
  );
}
