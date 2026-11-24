'use client';

import * as RadixSelect from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Select = RadixSelect.Root;
export const SelectValue = RadixSelect.Value;

interface SelectTriggerProps extends React.ComponentPropsWithoutRef<typeof RadixSelect.Trigger> {
  className?: string;
  error?: string;
}

export function SelectTrigger({ className, children, error, ...props }: SelectTriggerProps) {
  return (
    <RadixSelect.Trigger
      className={cn(
        'flex h-10 w-full items-center justify-between rounded-lg border px-3 py-2',
        'bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white',
        'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'transition-colors',
        error
          ? 'border-red-500 dark:border-red-500'
          : 'border-slate-300 dark:border-slate-600',
        className,
      )}
      {...props}
    >
      {children}
      <RadixSelect.Icon>
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixSelect.Content>) {
  return (
    <RadixSelect.Portal>
      <RadixSelect.Content
        className={cn(
          'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-xl',
          'border border-slate-200 dark:border-slate-700',
          'bg-white dark:bg-slate-900 shadow-lg',
          'data-[state=open]:animate-fade-in',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1',
          className,
        )}
        position={position}
        {...props}
      >
        <RadixSelect.ScrollUpButton className="flex h-6 items-center justify-center text-slate-400">
          <ChevronUp className="h-4 w-4" />
        </RadixSelect.ScrollUpButton>
        <RadixSelect.Viewport
          className={cn(
            'p-1',
            position === 'popper' &&
              'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
          )}
        >
          {children}
        </RadixSelect.Viewport>
        <RadixSelect.ScrollDownButton className="flex h-6 items-center justify-center text-slate-400">
          <ChevronDown className="h-4 w-4" />
        </RadixSelect.ScrollDownButton>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<typeof RadixSelect.Item>) {
  return (
    <RadixSelect.Item
      className={cn(
        'relative flex w-full cursor-default select-none items-center rounded-md py-2 pl-8 pr-2',
        'text-sm text-slate-700 dark:text-slate-200',
        'focus:bg-indigo-50 dark:focus:bg-indigo-900/20 focus:text-indigo-700 dark:focus:text-indigo-300',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        'outline-none',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <RadixSelect.ItemIndicator>
          <Check className="h-4 w-4" />
        </RadixSelect.ItemIndicator>
      </span>
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  );
}
