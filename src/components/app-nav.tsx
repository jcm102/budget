
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Banknote, CreditCard, Home, Lightbulb, PiggyBank, Settings, Users, Wallet, Ship, Library, ChevronDown } from 'lucide-react';
import {
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubContent,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
  SidebarHeader
} from '@/components/ui/sidebar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Button } from './ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import React from 'react';

const navItems = [
    { href: '/', icon: Home, label: 'Tasks' },
    { href: '/debt', icon: Wallet, label: 'Debt Worksheet' },
    { href: '/budget', icon: Banknote, label: 'Budget Overview' },
    { href: '/expenses', icon: CreditCard, label: 'Work Expenses' },
    { href: '/savings', icon: PiggyBank, label: 'Future Spending' },
    { href: '/split', icon: Users, label: 'Split Calculator' },
];

function ReferenceMenu() {
    const { open: sidebarOpen } = useSidebar();
    const [open, setOpen] = React.useState(false);

    React.useEffect(() => {
        if (!sidebarOpen) {
            setOpen(false);
        }
    }, [sidebarOpen]);

    return (
        <SidebarMenuSub>
            <SidebarMenuButton onClick={() => setOpen(!open)} className="font-medium">
                <Library />
                <span>Reference</span>
                <ChevronDown
                    className={cn(
                    "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
                    open && "rotate-180"
                    )}
                />
            </SidebarMenuButton>
            {open && (
            <SidebarMenuSubContent>
                <SidebarMenuSubItem>
                    <Link href="/savings#account-ledger">
                        <SidebarMenuSubButton>Account Ledger</SidebarMenuSubButton>
                    </Link>
                </SidebarMenuSubItem>
                 <SidebarMenuSubItem>
                    <Link href="/savings#sinking-funds">
                        <SidebarMenuSubButton>Sinking Funds</SidebarMenuSubButton>
                    </Link>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                    <Link href="/savings#autoship-table">
                        <SidebarMenuSubButton>Auto-Shipments</SidebarMenuSubButton>
                    </Link>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                    <Link href="/savings#subscription-table">
                        <SidebarMenuSubButton>Subscriptions</SidebarMenuSubButton>
                    </Link>
                </SidebarMenuSubItem>
            </SidebarMenuSubContent>
            )}
       </SidebarMenuSub>
    )
}

export function AppNav() {
  const pathname = usePathname();

  return (
    <>
      <SidebarHeader className="p-4">
        <h2 className="text-2xl font-bold text-sidebar-primary">TaskTrack Budget</h2>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <Link href={item.href}>
                <SidebarMenuButton isActive={pathname === item.href} tooltip={item.label}>
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
           <ReferenceMenu />
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="flex-col !items-stretch gap-2">
        <Popover>
            <PopoverTrigger asChild>
                <Button variant="ghost" className="justify-start">
                    <Lightbulb className="mr-2 h-4 w-4" />
                    Splitwise Tip
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" side="right" align="start">
                <h4 className="font-medium leading-none">Entering Splitwise Transactions</h4>
                <div className="text-sm text-muted-foreground mt-2 space-y-2">
                <div>
                    <h5 className="font-semibold">If You Paid (e.g., on Credit Card):</h5>
                    <p className="pl-2">1. Create a single transaction for the **full amount** from your Credit Card account.</p>
                    <p className="pl-2">2. **Split the transaction:**
                        <br/>- Categorize your half as the actual expense (e.g., Groceries).
                        <br/>- Categorize your partner's half as a transfer **to** your Splitwise account.
                    </p>
                </div>
                <div>
                    <h5 className="font-semibold">If Your Partner Paid:</h5>
                     <p className="pl-2">1. Create a transaction for **your half only**.</p>
                     <p className="pl-2">2. The "payment" for this transaction should come **from** your Splitwise account.</p>
                </div>
                </div>
            </PopoverContent>
        </Popover>
        <Link href="/settings">
          <SidebarMenuButton isActive={pathname === '/settings'} tooltip="Settings">
            <Settings />
            <span>Settings</span>
          </SidebarMenuButton>
        </Link>
      </SidebarFooter>
    </>
  );
}
