'use client';

import { usePathname, useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Avatar from '@radix-ui/react-avatar';
import { LogOut, User as UserIcon, ChevronDown } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '@/lib/utils';
import type { User } from '@/types';
import api from '@/lib/api';

interface HeaderProps {
  user: User | null | undefined;
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/compose': 'Compose',
  '/scheduled': 'Scheduled',
  '/sent': 'Sent',
  '/failed': 'Failed',
  '/search': 'Search',
  '/monitoring': 'Monitoring',
  '/slack': 'Slack Integration',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname === path || pathname.startsWith(path + '/')) {
      return title;
    }
  }
  return 'ReachInbox';
}

function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const title = getPageTitle(pathname);

  async function handleLogout() {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Ignore errors — redirect regardless
    }
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h1>

      <div className="flex items-center gap-2">
        <ThemeToggle />

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg',
                'hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500',
              )}
              aria-label="User menu"
            >
              <Avatar.Root className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900 overflow-hidden flex-shrink-0">
                {user?.avatar ? (
                  <Avatar.Image
                    src={user.avatar}
                    alt={user.name}
                    className="h-full w-full object-cover"
                  />
                ) : null}
                <Avatar.Fallback className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                  {getInitials(user?.name)}
                </Avatar.Fallback>
              </Avatar.Root>
              <span className="hidden sm:block text-sm font-medium text-slate-700 dark:text-slate-200 max-w-[120px] truncate">
                {user?.name ?? 'Account'}
              </span>
              <ChevronDown className="hidden sm:block w-4 h-4 text-slate-400" />
            </button>
          </DropdownMenu.Trigger>

          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className={cn(
                'z-50 min-w-[180px] rounded-xl border border-slate-200 dark:border-slate-700',
                'bg-white dark:bg-slate-900 shadow-lg p-1',
                'data-[state=open]:animate-fade-in',
              )}
            >
              {user && (
                <>
                  <div className="px-3 py-2 mb-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {user.email}
                    </p>
                  </div>
                  <DropdownMenu.Separator className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                </>
              )}

              <DropdownMenu.Item
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer',
                  'text-slate-700 dark:text-slate-200',
                  'hover:bg-slate-100 dark:hover:bg-slate-800 outline-none',
                )}
                onSelect={() => router.push('/settings')}
              >
                <UserIcon className="w-4 h-4" />
                Profile
              </DropdownMenu.Item>

              <DropdownMenu.Item
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer',
                  'text-red-600 dark:text-red-400',
                  'hover:bg-red-50 dark:hover:bg-red-900/20 outline-none',
                )}
                onSelect={handleLogout}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </header>
  );
}
