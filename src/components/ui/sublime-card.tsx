import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SublimeCardProps {
  title: string;
  value: string | number;
  secondaryText?: string;
  icon: LucideIcon;
  variant?: 'cyan' | 'violet' | 'emerald';
  className?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
}

export function SublimeCard({
  title,
  value,
  secondaryText,
  icon: Icon,
  variant = 'cyan',
  className,
  trend,
}: SublimeCardProps) {
  const accentGlow = {
    cyan: 'group-hover:border-cyan-500/40 group-hover:shadow-[0_0_25px_rgba(6,182,212,0.15)]',
    violet: 'group-hover:border-violet-500/40 group-hover:shadow-[0_0_25px_rgba(139,92,246,0.15)]',
    emerald: 'group-hover:border-emerald-500/40 group-hover:shadow-[0_0_25px_rgba(16,185,129,0.15)]',
  };

  const iconStyles = {
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    violet: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  };

  return (
    <div
      className={cn(
        'group glow-card p-5 sm:p-6 relative overflow-hidden transition-all duration-300',
        accentGlow[variant],
        className
      )}
    >
      {/* Feixe sutil de luz interna no topo do card */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/30 dark:via-white/10 to-transparent" />

      <div className="flex items-center justify-between mb-3.5">
        <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 font-heading">
          {title}
        </span>
        <div
          className={cn(
            'p-2.5 rounded-xl border transition-transform duration-300 group-hover:scale-110',
            iconStyles[variant]
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="text-2xl sm:text-3xl font-extrabold font-heading text-slate-900 dark:text-slate-50 tracking-tight">
        {value}
      </div>

      {(secondaryText || trend) && (
        <div className="mt-2 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-normal">
          {trend && (
            <span
              className={cn(
                'font-semibold font-mono',
                trend.isPositive ? 'text-emerald-500' : 'text-rose-500'
              )}
            >
              {trend.value}
            </span>
          )}
          {secondaryText && <span>{secondaryText}</span>}
        </div>
      )}
    </div>
  );
}
