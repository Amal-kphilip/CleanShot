'use client';

import React from 'react';
import { Download, Trash2, Sparkles, Archive, Loader2 } from 'lucide-react';
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
    <div className="fixed bottom-4 sm:bottom-6 inset-x-0 z-30 flex justify-center px-3 sm:px-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-lg glass bg-white/90 dark:bg-n-900/90 rounded-2xl shadow-xl shadow-black/[0.12] dark:shadow-black/[0.4] border border-n-200 dark:border-white/[0.08] p-3 sm:p-3.5 flex items-center justify-between gap-2.5 animate-slide-up"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        {/* Left: file count + size */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-n-100 dark:bg-white/[0.07] text-n-700 dark:text-n-300 flex items-center justify-center font-bold text-[13px] shrink-0 border border-n-200 dark:border-white/[0.07]">
            {selectedFiles.length}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-n-900 dark:text-white truncate">
              {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'}
            </div>
            <div className="text-[11px] text-n-400 dark:text-n-500 truncate">
              {formatBytes(totalBytes)}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onClearAll}
            disabled={isProcessing}
            className="px-3 py-2 rounded-xl text-[12px] font-medium text-n-500 dark:text-n-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-n-100 dark:hover:bg-white/[0.05] transition-colors disabled:opacity-40"
          >
            Clear
          </button>

          {hasQueued && (
            <button
              type="button"
              onClick={onProcessAll}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-accent dark:bg-accent-dark hover:opacity-90 active:scale-95 text-white text-[13px] font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Stripping…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden xs:inline">Remove Metadata</span>
                  <span className="xs:hidden">Clean</span>
                  <span className="ml-0.5 text-white/70 text-[11px] font-normal">({queuedFiles.length})</span>
                </>
              )}
            </button>
          )}

          {allCompleted && (
            <button
              type="button"
              onClick={onDownloadZip}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[13px] font-semibold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Download ZIP</span>
              <span className="ml-0.5 text-white/70 text-[11px] font-normal">({completedFiles.length})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
