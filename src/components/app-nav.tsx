
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Banknote, PiggyBank, Settings, Users, Wallet, Briefcase, LayoutGrid, Landmark, Calculator, TrendingUp, LogOut } from 'lucide-react';
import {
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarHeader
} from '@/components/ui/sidebar';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';

const navItems = [
    { href: '/budget', icon: Banknote, label: 'Budget Overview' },
    { href: '/accounts', icon: Landmark, label: 'Accounts' },
    { href: '/debt', icon: Wallet, label: 'Debt Worksheet' },
    { href: '/monthly-budget', icon: LayoutGrid, label: 'Monthly Budget' },
    { href: '/expenses', icon: Briefcase, label: 'Work Expenses' },
    { href: '/savings', icon: PiggyBank, label: 'Sinking Funds' },
    { href: '/reports', icon: TrendingUp, label: 'Reports' },
    { href: '/split', icon: Users, label: 'Split Calculator' },
    { href: '/calculator', icon: Calculator, label: 'Calculator' },
];


export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();

  const handleSignOut = async () => {
    await signOut(auth);
    router.push('/login');
  };


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
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="flex-col !items-stretch gap-2">
        <Link href="/settings">
          <SidebarMenuButton isActive={pathname === '/settings'} tooltip="Settings">
            <Settings />
            <span>Settings</span>
          </SidebarMenuButton>
        </Link>
        <SidebarMenuButton onClick={handleSignOut} tooltip="Sign Out">
          <LogOut />
          <span>Sign Out</span>
        </SidebarMenuButton>
      </SidebarFooter>
    </>
  );
}
