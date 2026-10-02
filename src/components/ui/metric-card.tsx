import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  accentColor?: 'cyan' | 'violet' | 'emerald' | 'rose';
  className?: string;
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  accentColor = 'cyan',
  className,
}: MetricCardProps) {
  const colorMap = {
    cyan: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
    violet: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    rose: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
  };

  return (
    <div className={cn('glow-card p-5 relative overflow-hidden', className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <div className={cn('p-2 rounded-lg border', colorMap[accentColor])}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-bold font-heading text-slate-900 dark:text-slate-50 mb-1">
        {value}
      </div>
      {(subtitle || trend) && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {trend && (
            <span className={cn('font-medium', trend.isPositive ? 'text-emerald-500' : 'text-rose-500')}>
              {trend.value}
            </span>
          )}
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
