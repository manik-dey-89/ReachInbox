'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

export const Modal = Dialog.Root;
export const ModalTrigger = Dialog.Trigger;
export const ModalClose = Dialog.Close;

interface ModalContentProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ModalContent({ children, className, ...props }: ModalContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-fade-in" />
      <Dialog.Content
        className={cn(
          'fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl',
          'border border-slate-200 dark:border-slate-800',
          'p-6 data-[state=open]:animate-slide-in',
          'focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
        <Dialog.Close className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export function ModalHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex flex-col gap-1 mb-4', className)}
      {...props}
    />
  );
}

export function ModalTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <Dialog.Title
      className={cn('text-lg font-semibold text-slate-900 dark:text-white', className)}
      {...props}
    >
      {children}
    </Dialog.Title>
  );
}

export function ModalFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800', className)}
      {...props}
    />
  );
}
