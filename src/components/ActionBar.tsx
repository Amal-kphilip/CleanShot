'use client';

import React from 'react';
import { Download, Trash2, RefreshCw, Archive, Check } from 'lucide-react';
import { FileItemState } from './FileList';

interface ActionBarProps {
  files: FileItemState[];
  isProcessing: boolean;
  onDownloadZip: () => void;
  onClearAll: () => void;
  onProcessAll: () => void;
}

export function ActionBar({
  files,
  isProcessing,
  onDownloadZip,
  onClearAll,
  onProcessAll,
}: ActionBarProps) {
  if (files.length === 0) return null;

  const selectedFiles = files.filter((f) => f.selected !== false);
  const completedFiles = selectedFiles.filter((f) => f.status === 'completed');
  const hasQueued = files.some((f) => f.status === 'queued');

  const totalBytes = selectedFiles.reduce(
    (acc, f) => acc + (f.result ? f.result.cleanedSize : f.file.size),
    0
  );

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed bottom-6 inset-x-0 z-30 flex justify-center px-4 pointer-events-none animate-slide-up">
      <div className="pointer-events-auto max-w-2xl w-full bg-white/95 dark:bg-surface-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-800 p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Summary Count */}
        <div className="flex items-center gap-3 text-xs text-surface-600 dark:text-surface-300">
          <div className="w-8 h-8 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
            {selectedFiles.length}
          </div>
          <div>
            <span className="font-semibold text-surface-900 dark:text-white block">
              {selectedFiles.length} of {files.length} {selectedFiles.length === 1 ? 'file' : 'files'} selected
            </span>
            <span className="text-[11px] text-surface-500 dark:text-surface-400">
              Total archive size: {formatBytes(totalBytes)}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {/* Clear All */}
          <button
            type="button"
            onClick={onClearAll}
            disabled={isProcessing}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-surface-600 dark:text-surface-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-50"
          >
            Clear All
          </button>

          {/* Process All (if any queued) */}
          {hasQueued && (
            <button
              type="button"
              onClick={onProcessAll}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-surface-900 dark:text-white text-xs font-semibold border border-surface-200 dark:border-surface-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>Strip All</span>
            </button>
          )}

          {/* Download ZIP */}
          <button
            type="button"
            onClick={onDownloadZip}
            disabled={completedFiles.length === 0 || isProcessing}
            className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold shadow-md shadow-brand-500/20 flex items-center gap-2 transition-all hover:scale-[1.02] disabled:opacity-50 disabled:pointer-events-none"
          >
            <Archive className="w-4 h-4" />
            <span>
              Download ZIP ({completedFiles.length})
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
