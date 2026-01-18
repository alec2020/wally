'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Receipt,
  Upload,
  BarChart3,
  Settings,
  Wallet,
  PiggyBank,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Transactions', href: '/transactions', icon: Receipt },
  { name: 'Upload', href: '/upload', icon: Upload },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Net Worth', href: '/net-worth', icon: PiggyBank },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-64 flex-col bg-neutral-900">
      <div className="flex h-16 shrink-0 items-center gap-2 px-6">
        <Wallet className="h-8 w-8 text-primary" />
        <span className="text-xl font-bold text-white">FinanceTracker</span>
      </div>
      <nav className="flex flex-1 flex-col px-4 py-4">
        <ul role="list" className="flex flex-1 flex-col gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    'group flex gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/20 text-white'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <item.icon
                    className={cn(
                      'h-5 w-5 shrink-0',
                      isActive ? 'text-primary' : 'text-gray-400 group-hover:text-white'
                    )}
                  />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="mt-auto">
          <Link
            href="/settings"
            className="group flex gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
          >
            <Settings className="h-5 w-5 shrink-0 text-gray-400 group-hover:text-white" />
            Settings
          </Link>
        </div>
      </nav>
    </div>
  );
}
