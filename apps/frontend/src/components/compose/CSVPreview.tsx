import { cn } from '@/lib/utils';

export interface CSVPreviewRow {
  email: string;
  name?: string;
  valid: boolean;
  duplicate: boolean;
}

interface CSVPreviewProps {
  rows: CSVPreviewRow[];
  maxRows?: number;
}

export function CSVPreview({ rows, maxRows = 5 }: CSVPreviewProps) {
  const displayed = rows.slice(0, maxRows);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden text-sm">
      <table className="w-full caption-bottom">
        <thead className="border-b border-slate-200 dark:border-slate-700">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
              Email
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
              Name
            </th>
            <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {displayed.map((row, idx) => (
            <tr
              key={idx}
              className={cn(
                !row.valid && 'bg-red-50 dark:bg-red-900/10',
                row.valid && row.duplicate && 'bg-yellow-50 dark:bg-yellow-900/10',
              )}
            >
              <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{row.email}</td>
              <td className="px-3 py-2 text-slate-500 dark:text-slate-400">{row.name ?? '—'}</td>
              <td className="px-3 py-2">
                {!row.valid ? (
                  <span className="text-red-600 dark:text-red-400 font-medium text-xs">Invalid</span>
                ) : row.duplicate ? (
                  <span className="text-yellow-600 dark:text-yellow-400 font-medium text-xs">Duplicate</span>
                ) : (
                  <span className="text-green-600 dark:text-green-400 font-medium text-xs">Valid</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > maxRows && (
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 border-t border-slate-200 dark:border-slate-700">
          Showing {maxRows} of {rows.length} rows
        </div>
      )}
    </div>
  );
}
