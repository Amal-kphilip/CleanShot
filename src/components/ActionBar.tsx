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
    <div className="fixed bottom-4 sm:bottom-6 inset-x-0 z-30 flex justify-center px-4 pointer-events-none">
      <div
        className="pointer-events-auto w-full max-w-lg liquid-glass-nav rounded-pill p-2 sm:p-2.5 flex items-center justify-between gap-3 shadow-floating transition-all duration-apple ease-apple animate-slide-up"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}
      >
        {/* Left: file count + size */}
        <div className="flex items-center gap-2.5 min-w-0 pl-2">
          <div className="w-8 h-8 rounded-full bg-black/[0.04] dark:bg-white/[0.08] text-foreground flex items-center justify-center font-semibold text-[13px] shrink-0 border border-border-glass">
            {selectedFiles.length}
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-foreground truncate">
              {selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'}
            </div>
            <div className="text-[11px] text-text-ter truncate">
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
            className="px-3 py-1.5 rounded-pill text-[12px] font-medium text-text-sec hover:text-red-500 hover:bg-black/[0.03] dark:hover:bg-white/[0.05] apple-spring apple-press disabled:opacity-40"
          >
            Clear
          </button>

          {hasQueued && (
            <button
              type="button"
              onClick={onProcessAll}
              disabled={isProcessing}
              className="px-4 py-2 rounded-pill bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 active:scale-[0.97] text-white text-[13px] font-semibold flex items-center gap-1.5 shadow-accent-button apple-spring disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <span className="ml-0.5 text-white/80 text-[11px] font-normal">({queuedFiles.length})</span>
                </>
              )}
            </button>
          )}

          {allCompleted && (
            <button
              type="button"
              onClick={onDownloadZip}
              disabled={isProcessing}
              className="px-4 py-2 rounded-pill bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] text-white text-[13px] font-semibold flex items-center gap-1.5 shadow-sm apple-spring"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Download ZIP</span>
              <span className="ml-0.5 text-white/80 text-[11px] font-normal">({completedFiles.length})</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
