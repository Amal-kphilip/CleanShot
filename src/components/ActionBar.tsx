'use client';

import React from 'react';
import { Download, Trash2, Sparkles, Archive, Loader2, ShieldCheck } from 'lucide-react';
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
  const queuedFiles = selectedFiles.filter((f) => f.status === 'queued');
  const completedFiles = selectedFiles.filter((f) => f.status === 'completed');

  const hasQueued = queuedFiles.length > 0;
  const allCompleted = completedFiles.length > 0 && queuedFiles.length === 0;

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
    <div className="fixed bottom-3 sm:bottom-6 inset-x-0 z-30 flex justify-center px-3 sm:px-4 pointer-events-none animate-slide-up">
      <div className="pointer-events-auto max-w-xl w-full bg-white/95 dark:bg-surface-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-800 p-2.5 sm:p-3.5 flex items-center justify-between gap-2.5">
        {/* Left: Summary Count */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs shrink-0">
            {selectedFiles.length}
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-surface-900 dark:text-white text-xs sm:text-sm truncate block">
              {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'} selected
            </span>
            <span className="text-[10px] sm:text-[11px] text-surface-500 dark:text-surface-400 block truncate">
              {formatBytes(totalBytes)}
            </span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Clear All */}
          <button
            type="button"
            onClick={onClearAll}
            disabled={isProcessing}
            className="px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold text-surface-600 dark:text-surface-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors disabled:opacity-50"
          >
            Clear
          </button>

          {/* If there are queued files: show prominent Remove Metadata button */}
          {hasQueued && (
            <button
              type="button"
              onClick={onProcessAll}
              disabled={isProcessing}
              className="px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-700 hover:to-indigo-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-brand-500/25 flex items-center gap-1.5 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Stripping...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>Remove Metadata ({queuedFiles.length})</span>
                </>
              )}
            </button>
          )}

          {/* When all selected are completed: show Download ZIP button */}
          {allCompleted && (
            <button
              type="button"
              onClick={onDownloadZip}
              disabled={isProcessing}
              className="px-3.5 sm:px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-emerald-500/20 flex items-center gap-1.5 transition-all"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Download ZIP ({completedFiles.length})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
