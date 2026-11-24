'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ScheduleValue {
  scheduledAt: string;
  delayBetweenMs: number;
  hourlyLimit: number;
}

interface ScheduleControlsProps {
  value: ScheduleValue;
  onChange: (value: ScheduleValue) => void;
}

const DELAY_PRESETS = [
  { label: '1s', ms: 1000 },
  { label: '5s', ms: 5000 },
  { label: '30s', ms: 30000 },
  { label: '1 min', ms: 60000 },
];

function toDatetimeLocalValue(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
      `T${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  } catch {
    return '';
  }
}

export function ScheduleControls({ value, onChange }: ScheduleControlsProps) {
  const [customDelay, setCustomDelay] = useState('');
  const [useCustomDelay, setUseCustomDelay] = useState(false);

  const presetSelected = DELAY_PRESETS.find((p) => p.ms === value.delayBetweenMs);

  function setField<K extends keyof ScheduleValue>(key: K, val: ScheduleValue[K]) {
    onChange({ ...value, [key]: val });
  }

  function handleDatetimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const local = e.target.value;
    if (!local) return;
    setField('scheduledAt', new Date(local).toISOString());
  }

  function handlePresetClick(ms: number) {
    setUseCustomDelay(false);
    setCustomDelay('');
    setField('delayBetweenMs', ms);
  }

  function handleCustomDelay(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setCustomDelay(raw);
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setField('delayBetweenMs', parsed);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Scheduled time */}
      <div className="flex flex-col gap-1.5">
        <Label>Send at</Label>
        <input
          type="datetime-local"
          value={toDatetimeLocalValue(value.scheduledAt)}
          onChange={handleDatetimeChange}
          className={cn(
            'h-10 w-full rounded-lg border border-slate-300 dark:border-slate-600',
            'bg-white dark:bg-slate-800 px-3 text-sm',
            'text-slate-900 dark:text-white',
            'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
            'transition-colors',
          )}
        />
      </div>

      {/* Delay between emails */}
      <div className="flex flex-col gap-1.5">
        <Label>Delay between emails</Label>
        <div className="flex flex-wrap gap-2">
          {DELAY_PRESETS.map((preset) => (
            <Button
              key={preset.ms}
              type="button"
              variant={!useCustomDelay && presetSelected?.ms === preset.ms ? 'default' : 'outline'}
              size="sm"
              onClick={() => handlePresetClick(preset.ms)}
            >
              {preset.label}
            </Button>
          ))}
          <Button
            type="button"
            variant={useCustomDelay ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUseCustomDelay(true)}
          >
            Custom
          </Button>
        </div>
        {useCustomDelay && (
          <div className="flex items-center gap-2 mt-1">
            <Input
              type="number"
              min={0}
              value={customDelay}
              onChange={handleCustomDelay}
              placeholder="Milliseconds"
              className="max-w-[160px]"
            />
            <span className="text-xs text-slate-500">ms</span>
          </div>
        )}
      </div>

      {/* Hourly limit */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="hourlyLimit">Hourly limit</Label>
        <Input
          id="hourlyLimit"
          type="number"
          min={1}
          max={1000}
          value={value.hourlyLimit}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n)) setField('hourlyLimit', Math.min(1000, Math.max(1, n)));
          }}
          className="max-w-[160px]"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Max emails per sender per hour (1–1000)
        </p>
      </div>
    </div>
  );
}
