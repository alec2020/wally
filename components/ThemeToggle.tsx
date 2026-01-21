'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex w-fit items-center rounded-md bg-neutral-800 p-0.5">
        <div className="h-7 w-7" />
        <div className="h-7 w-7" />
      </div>
    );
  }

  return (
    <div className="flex w-fit items-center rounded-md bg-neutral-800 p-0.5">
      <button
        onClick={() => setTheme('light')}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded transition-colors',
          theme === 'light'
            ? 'bg-neutral-600 text-white'
            : 'text-gray-500 hover:text-gray-300'
        )}
        title="Light mode"
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded transition-colors',
          theme === 'dark'
            ? 'bg-neutral-600 text-white'
            : 'text-gray-500 hover:text-gray-300'
        )}
        title="Dark mode"
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
