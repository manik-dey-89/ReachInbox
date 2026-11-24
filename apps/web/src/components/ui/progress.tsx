'use client';

import * as RadixProgress from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

interface ProgressProps extends React.ComponentPropsWithoutRef<typeof RadixProgress.Root> {
  value: number;
  max?: number;
  showLabel?: boolean;
  className?: string;
}

export function Progress({ value, max = 100, showLabel = false, className, ...props }: ProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="flex items-center gap-2">
      <RadixProgress.Root
        className={cn(
          'relative h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700',
          className,
        )}
        value={value}
        max={max}
        {...props}
      >
        <RadixProgress.Indicator
          className="h-full bg-indigo-600 transition-all duration-300 ease-in-out rounded-full"
          style={{ width: `${percentage}%` }}
        />
      </RadixProgress.Root>
      {showLabel && (
        <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[2.5rem] text-right">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}
