'use client';

import { useState, useRef } from 'react';
import * as RadixTabs from '@radix-ui/react-tabs';
import Papa from 'papaparse';
import { AlertTriangle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { CSVPreview, type CSVPreviewRow } from './CSVPreview';
import { cn } from '@/lib/utils';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Recipient {
  email: string;
  name?: string;
}

interface RecipientUploaderProps {
  onChange: (recipients: Recipient[]) => void;
}

function parseAndValidate(entries: Recipient[]): {
  valid: Recipient[];
  invalid: string[];
  duplicates: string[];
  previewRows: CSVPreviewRow[];
} {
  const seen = new Set<string>();
  const invalid: string[] = [];
  const duplicates: string[] = [];
  const valid: Recipient[] = [];
  const previewRows: CSVPreviewRow[] = [];

  for (const entry of entries) {
    const isValid = EMAIL_REGEX.test(entry.email.trim());
    const normalised = entry.email.trim().toLowerCase();
    const isDuplicate = seen.has(normalised);

    previewRows.push({ email: entry.email, name: entry.name, valid: isValid, duplicate: isDuplicate });

    if (!isValid) {
      invalid.push(entry.email);
    } else if (isDuplicate) {
      duplicates.push(entry.email);
    } else {
      seen.add(normalised);
      valid.push({ email: entry.email.trim(), name: entry.name });
    }
  }

  return { valid, invalid, duplicates, previewRows };
}

export function RecipientUploader({ onChange }: RecipientUploaderProps) {
  const [manualText, setManualText] = useState('');
  const [previewRows, setPreviewRows] = useState<CSVPreviewRow[]>([]);
  const [invalidEmails, setInvalidEmails] = useState<string[]>([]);
  const [duplicateEmails, setDuplicateEmails] = useState<string[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [activeTab, setActiveTab] = useState('manual');
  const csvInputRef = useRef<HTMLInputElement>(null);
  const txtInputRef = useRef<HTMLInputElement>(null);

  function applyResult(result: ReturnType<typeof parseAndValidate>) {
    setPreviewRows(result.previewRows);
    setInvalidEmails(result.invalid);
    setDuplicateEmails(result.duplicates);
    setValidCount(result.valid.length);
    onChange(result.valid);
  }

  function handleManualChange(text: string) {
    setManualText(text);
    const parts = text.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    const entries: Recipient[] = parts.map((e) => ({ email: e }));
    applyResult(parseAndValidate(entries));
  }

  function handleCSVFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const entries: Recipient[] = results.data.map((row) => ({
          email: (row['email'] ?? row['Email'] ?? row['EMAIL'] ?? '').trim(),
          name: (row['name'] ?? row['Name'] ?? row['NAME'] ?? '').trim() || undefined,
        }));
        applyResult(parseAndValidate(entries));
      },
    });
  }

  function handleTXTFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const entries: Recipient[] = lines.map((e) => ({ email: e }));
      applyResult(parseAndValidate(entries));
    };
    reader.readAsText(file);
  }

  return (
    <div className="flex flex-col gap-4">
      <RadixTabs.Root value={activeTab} onValueChange={setActiveTab}>
        <RadixTabs.List className="flex gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 p-1 w-fit">
          {(['manual', 'csv', 'txt'] as const).map((tab) => (
            <RadixTabs.Trigger
              key={tab}
              value={tab}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                'text-slate-600 dark:text-slate-400',
                'data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700',
                'data-[state=active]:text-slate-900 dark:data-[state=active]:text-white',
                'data-[state=active]:shadow-sm',
              )}
            >
              {tab === 'manual' ? 'Manual' : tab === 'csv' ? 'CSV Upload' : 'TXT Upload'}
            </RadixTabs.Trigger>
          ))}
        </RadixTabs.List>

        <RadixTabs.Content value="manual" className="mt-3">
          <Textarea
            value={manualText}
            onChange={(e) => handleManualChange(e.target.value)}
            placeholder="Enter emails separated by commas or new lines&#10;e.g. alice@example.com, bob@example.com"
            rows={5}
          />
        </RadixTabs.Content>

        <RadixTabs.Content value="csv" className="mt-3">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload a CSV file with an <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">email</code> column and optional <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">name</code> column.
            </p>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleCSVFile(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => csvInputRef.current?.click()}
            >
              Choose CSV file
            </Button>
          </div>
        </RadixTabs.Content>

        <RadixTabs.Content value="txt" className="mt-3">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upload a plain text file with one email address per line.
            </p>
            <input
              ref={txtInputRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleTXTFile(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => txtInputRef.current?.click()}
            >
              Choose TXT file
            </Button>
          </div>
        </RadixTabs.Content>
      </RadixTabs.Root>

      {previewRows.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-green-600 dark:text-green-400">
            {validCount} valid recipient{validCount !== 1 ? 's' : ''}
          </p>

          {invalidEmails.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-900/10 p-3 text-sm text-red-700 dark:text-red-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">
                  {invalidEmails.length} invalid email{invalidEmails.length !== 1 ? 's' : ''} removed:
                </p>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  {invalidEmails.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  {invalidEmails.length > 5 && <li>…and {invalidEmails.length - 5} more</li>}
                </ul>
              </div>
            </div>
          )}

          {duplicateEmails.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">
                  {duplicateEmails.length} duplicate{duplicateEmails.length !== 1 ? 's' : ''} removed:
                </p>
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  {duplicateEmails.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                  {duplicateEmails.length > 5 && <li>…and {duplicateEmails.length - 5} more</li>}
                </ul>
              </div>
            </div>
          )}

          <CSVPreview rows={previewRows} maxRows={5} />
        </div>
      )}
    </div>
  );
}
