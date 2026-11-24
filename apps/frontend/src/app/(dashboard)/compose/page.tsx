'use client';

import { EmailComposer } from '@/components/compose/EmailComposer';

export default function ComposePage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Compose Email</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Create a new email campaign. Add recipients, write your message, and schedule delivery.
        </p>
      </div>
      <EmailComposer />
    </div>
  );
}
