'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl glow-card opacity-50" />;
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="glow-card relative p-2 sm:p-2.5 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center text-slate-800 dark:text-slate-100 cursor-pointer"
      title={isDark ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
      aria-label="Alternar Tema"
    >
      {isDark ? (
        <Sun className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] transition-all" />
      ) : (
        <Moon className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-cyan-600 drop-shadow-[0_0_8px_rgba(6,182,212,0.4)] transition-all" />
      )}
    </button>
  );
}
