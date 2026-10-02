import React from 'react';
import { cn } from '@/lib/utils';

interface GlowCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function GlowCard({ children, className, ...props }: GlowCardProps) {
  return (
    <div className={cn('glow-card p-5 relative overflow-hidden', className)} {...props}>
      {children}
    </div>
  );
}
