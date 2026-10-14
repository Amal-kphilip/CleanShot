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

  let totalMetadataBlocksRemoved = 0;
  let totalBytesSaved = 0;
  let gpsCount = 0;
  let serialCount = 0;

  for (const f of completedFiles) {
    if (f.result) {
      totalMetadataBlocksRemoved += f.result.removedFieldsCount;
      totalBytesSaved += f.result.bytesSaved;
    }
    if (f.metadata?.gps) gpsCount++;
    if (f.metadata?.categories.camera) serialCount++;
  }

  const formatBytes = (bytes: number): string => {
    const absolute = Math.abs(bytes);
    if (absolute === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(sizes.length - 1, Math.floor(Math.log(absolute) / Math.log(1024)));
    const value = `${(absolute / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
    return bytes < 0 ? `+${value}` : bytes > 0 ? `-${value}` : '0 B';
  };

  const metrics = [
    { label: 'Metadata Blocks Removed', value: totalMetadataBlocksRemoved },
    { label: 'Net Size Change', value: formatBytes(totalBytesSaved) },
    { label: 'Files With GPS Before Cleaning', value: `${gpsCount}` },
    { label: 'Files With Camera Data', value: `${serialCount}` },
  ];

  return (
    <div className="w-full rounded-card liquid-glass overflow-hidden shadow-glass animate-fade-up">
      {/* Header row */}
      <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-small bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[14px] font-semibold text-foreground">
              {completedFiles.length} {completedFiles.length === 1 ? 'photo' : 'photos'} cleaned
            </div>
            <div className="text-[12px] text-text-ter">
              Supported format · No image re-encoding
            </div>
          </div>
        </div>
        <span className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium px-3 py-1 rounded-pill bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          No re-encoding
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border-subtle">
        {metrics.map((m) => (
          <div key={m.label} className="px-5 sm:px-6 py-4">
            <div className="text-[11px] font-semibold text-text-ter uppercase tracking-caps mb-1.5">
              {m.label}
            </div>
            <div className="text-[22px] font-semibold text-foreground tabular-nums leading-none">
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
