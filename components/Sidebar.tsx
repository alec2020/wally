'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Squares2X2Icon,
  ReceiptPercentIcon,
  ArrowUpTrayIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  BanknotesIcon,
  Bars3BottomLeftIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';

function WallyLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 7L7.5 17L12 9L16.5 17L20 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
import { ThemeToggle } from './ThemeToggle';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Squares2X2Icon },
  { name: 'Transactions', href: '/transactions', icon: ReceiptPercentIcon },
  { name: 'Upload', href: '/upload', icon: ArrowUpTrayIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
  { name: 'Net Worth', href: '/net-worth', icon: BanknotesIcon },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-2">
        <Link href="/" className="flex h-8 items-center">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <WallyLogo className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="ml-2 overflow-hidden whitespace-nowrap text-xl font-bold text-sidebar-foreground transition-all duration-200 ease-linear group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
            Wally
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    tooltip={item.name}
                    className={
                      isActive
                        ? 'bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary'
                        : ''
                    }
                  >
                    <Link href={item.href}>
                      <item.icon
                        className={
                          isActive
                            ? 'text-primary'
                            : 'text-sidebar-foreground/70'
                        }
                      />
                      <span>{item.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Settings">
              <Link href="/settings">
                <Cog6ToothIcon className="h-5 w-5 text-sidebar-foreground/70" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <div className="flex items-center justify-between gap-2 px-2 pt-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="group-data-[collapsible=icon]:hidden">
            <ThemeToggle />
          </div>
          <SidebarTrigger className="text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent">
            {isCollapsed ? (
              <Bars3Icon className="h-4 w-4" />
            ) : (
              <Bars3BottomLeftIcon className="h-4 w-4" />
            )}
          </SidebarTrigger>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
