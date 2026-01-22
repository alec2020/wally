'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex w-fit items-center rounded-md bg-neutral-200 p-0.5 dark:bg-neutral-800">
        <div className="h-7 w-7" />
        <div className="h-7 w-7" />
      </div>
    );
  }

  return (
    <div className="flex w-fit items-center rounded-md bg-neutral-200 p-0.5 dark:bg-neutral-800">
      <button
        onClick={() => setTheme('light')}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded transition-colors',
          theme === 'light'
            ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-600 dark:text-white'
            : 'text-neutral-500 hover:text-neutral-700 dark:text-gray-500 dark:hover:text-gray-300'
        )}
        title="Light mode"
      >
        <SunIcon className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded transition-colors',
          theme === 'dark'
            ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-600 dark:text-white'
            : 'text-neutral-500 hover:text-neutral-700 dark:text-gray-500 dark:hover:text-gray-300'
        )}
        title="Dark mode"
      >
        <MoonIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
