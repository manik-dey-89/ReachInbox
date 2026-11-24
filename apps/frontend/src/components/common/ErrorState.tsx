import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorStateProps {
  title?: string;
  message: string;
  retry?: () => void;
}

export function ErrorState({ title = 'Something went wrong', message, retry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
        <AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
      </div>
      <h3 className="mb-2 text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>
      {retry && (
        <Button onClick={retry} variant="outline" size="md">
          Try again
        </Button>
      )}
    </div>
  );
}
