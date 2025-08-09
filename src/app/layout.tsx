import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { SidebarProvider, Sidebar, SidebarInset, SidebarTrigger, SidebarHeader } from '@/components/ui/sidebar';
import { AppNav } from '@/components/app-nav';

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
        <SidebarProvider>
            <Sidebar>
                <AppNav />
            </Sidebar>
            <SidebarInset>
                <SidebarHeader>
                    <SidebarTrigger />
                </SidebarHeader>
                {children}
            </SidebarInset>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}
