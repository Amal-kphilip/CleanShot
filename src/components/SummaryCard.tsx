'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { FileItemState } from './FileList';

interface SummaryCardProps {
  files: FileItemState[];
}

export function SummaryCard({ files }: SummaryCardProps) {
  const completedFiles = files.filter((f) => f.status === 'completed');
  if (completedFiles.length === 0) return null;

  let totalFieldsRemoved = 0;
  let totalBytesSaved = 0;
  let gpsCount = 0;
  let serialCount = 0;

  for (const f of completedFiles) {
    if (f.result) {
      totalFieldsRemoved += f.result.removedFieldsCount || (f.metadata?.fields.length ?? 0);
      totalBytesSaved += f.result.bytesSaved;
    }
    if (f.metadata?.gps) gpsCount++;
    if (f.metadata?.categories.camera) serialCount++;
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const metrics = [
    { label: 'Fields Removed', value: totalFieldsRemoved || '—' },
    { label: 'Space Saved',    value: formatBytes(totalBytesSaved) },
    { label: 'GPS Wiped',      value: `${gpsCount}` },
    { label: 'Serials Stripped', value: `${serialCount}` },
  ];

  return (
    <div className="w-full rounded-2xl border border-n-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.025] overflow-hidden animate-fade-up">
      {/* Header row */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-n-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[13px] font-semibold text-n-900 dark:text-white">
              {completedFiles.length} {completedFiles.length === 1 ? 'photo' : 'photos'} cleaned
            </div>
            <div className="text-[11px] text-n-400 dark:text-n-500">
              Zero pixels re-compressed · Lossless
            </div>
          </div>
        </div>
        <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          Pixel-identical
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-n-100 dark:divide-white/[0.06]">
        {metrics.map((m) => (
          <div key={m.label} className="px-5 py-4">
            <div className="text-[11px] font-medium text-n-400 dark:text-n-500 uppercase tracking-wide mb-1">
              {m.label}
            </div>
            <div className="text-[22px] font-semibold text-n-900 dark:text-white leading-none">
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
