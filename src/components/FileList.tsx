'use client';

import React from 'react';
import {
  FileImage,
  Download,
  Eye,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  MapPin,
  Camera,
} from 'lucide-react';
import { StripResult, ParsedMetadata } from '@/lib/engine/types';

export interface FileItemState {
  id: string;
  file: File;
  relativePath?: string;
  thumbnailUrl: string;
  status: 'queued' | 'inspecting' | 'processing' | 'completed' | 'error';
  progress: number;
  result?: StripResult;
  metadata?: ParsedMetadata;
  error?: string;
  selected?: boolean;
}

interface FileListProps {
  files: FileItemState[];
  isProcessing?: boolean;
  onRemoveFile: (id: string) => void;
  onInspectFile: (file: FileItemState) => void;
  onDownloadFile: (file: FileItemState) => void;
  onToggleSelect: (id: string) => void;
  onProcessAll?: () => void;
}

export function FileList({
  files,
  isProcessing,
  onRemoveFile,
  onInspectFile,
  onDownloadFile,
  onToggleSelect,
  onProcessAll,
}: FileListProps) {
  if (files.length === 0) return null;

  const queuedCount = files.filter((f) => f.status === 'queued').length;
  const completedCount = files.filter((f) => f.status === 'completed').length;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-3 w-full">
      {/* List Header */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2.5">
          <h3 className="text-[13px] font-semibold text-n-900 dark:text-white">Queue</h3>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-n-100 dark:bg-white/[0.08] text-n-600 dark:text-n-300">
            {files.length}
          </span>
          {queuedCount > 0 && (
            <span className="text-[11px] font-medium text-n-400 dark:text-n-500">
              {queuedCount} ready
            </span>
          )}
          {completedCount > 0 && (
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              {completedCount} cleaned
            </span>
          )}
        </div>

        {queuedCount > 0 && onProcessAll && (
          <button
            type="button"
            onClick={onProcessAll}
            disabled={isProcessing}
            className="px-3.5 py-1.5 rounded-xl bg-accent dark:bg-accent-dark hover:opacity-90 active:scale-95 text-white text-[12px] font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing…</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Remove Metadata</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* File Cards */}
      <div className="space-y-2">
        {files.map((item) => {
          const isCompleted = item.status === 'completed';
          const isProcessingItem = item.status === 'processing' || item.status === 'inspecting';
          const isError = item.status === 'error';

          return (
            <div
              key={item.id}
              className={`group relative flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3.5 rounded-2xl border transition-all duration-200 ${
                isProcessingItem
                  ? 'border-accent/30 dark:border-accent/25 bg-accent/[0.03] dark:bg-accent/[0.04]'
                  : isError
                  ? 'border-red-200 dark:border-red-800/50 bg-red-50/30 dark:bg-red-950/10'
                  : isCompleted
                  ? 'border-n-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.025]'
                  : 'border-n-200 dark:border-white/[0.07] bg-white dark:bg-white/[0.025] hover:border-n-300 dark:hover:border-white/[0.12]'
              }`}
            >
              {/* Left: Checkbox + Thumbnail + Details */}
              <div className="flex items-center gap-3 min-w-0 flex-1 w-full sm:w-auto">
                {/* Selection checkbox */}
                <input
                  type="checkbox"
                  checked={item.selected !== false}
                  onChange={() => onToggleSelect(item.id)}
                  className="w-4 h-4 rounded text-accent focus:ring-accent border-n-300 dark:border-n-700 dark:bg-n-800 shrink-0"
                />

                {/* Thumbnail */}
                <div className="relative w-12 h-12 sm:w-11 sm:h-11 rounded-xl overflow-hidden bg-n-100 dark:bg-white/[0.05] border border-n-200 dark:border-white/[0.07] shrink-0 flex items-center justify-center">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileImage className="w-5 h-5 text-n-400" />
                  )}
                  {isProcessingItem && (
                    <div className="absolute inset-0 bg-n-900/50 backdrop-blur-[1px] flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                    </div>
                  )}
                  {isCompleted && (
                    <div className="absolute inset-0 bg-emerald-950/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    </div>
                  )}
                </div>

                {/* File info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className="text-[13px] font-semibold text-n-900 dark:text-white truncate max-w-[160px] sm:max-w-[240px] md:max-w-sm">
                      {item.result ? item.result.cleanedFilename : item.file.name}
                    </span>
                    {item.result && item.result.cleanedFilename !== item.file.name && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-accent/10 dark:bg-accent/[0.12] text-accent dark:text-accent-dark border border-accent/20 dark:border-accent/20">
                        Renamed
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-n-500 dark:text-n-400 flex-wrap">
                    <span>{formatBytes(item.file.size)}</span>

                    {item.result && item.result.bytesSaved > 0 && (
                      <>
                        <span className="text-n-300 dark:text-n-600">→</span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          -{formatBytes(item.result.bytesSaved)}
                        </span>
                      </>
                    )}

                    {/* Status indicator dot */}
                    {item.status === 'queued' && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                        <span className="text-n-400 dark:text-n-500">queued</span>
                      </span>
                    )}
                    {isProcessingItem && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent dark:bg-accent-dark animate-pulse inline-block" />
                        <span>processing</span>
                      </span>
                    )}
                    {isCompleted && (
                      <span className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                        <span className="text-emerald-600 dark:text-emerald-400">cleaned</span>
                      </span>
                    )}

                    {/* Sensitive data badges */}
                    {item.metadata?.gps && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                        <MapPin className="w-2.5 h-2.5" /> GPS
                      </span>
                    )}
                    {item.metadata?.categories.camera && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-n-100 dark:bg-white/[0.05] text-n-500 dark:text-n-400 border border-n-200 dark:border-white/[0.07]">
                        <Camera className="w-2.5 h-2.5" /> EXIF
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  {isProcessingItem && (
                    <div className="w-full max-w-[200px] h-0.5 bg-n-100 dark:bg-white/[0.07] rounded-full overflow-hidden mt-1.5">
                      <div
                        className="h-full bg-accent dark:bg-accent-dark transition-all duration-300 rounded-full"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}

                  {isError && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1 mt-0.5">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {item.error || 'Failed to process'}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Action buttons — visible on hover on desktop, always on mobile */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-n-100 dark:border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => onInspectFile(item)}
                  className="px-2.5 py-1.5 rounded-lg bg-n-100 hover:bg-n-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.09] text-n-600 dark:text-n-300 text-[12px] font-medium border border-n-200 dark:border-white/[0.08] flex items-center gap-1 transition-colors"
                  title="Inspect Metadata"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect</span>
                </button>

                {isCompleted && item.result && (
                  <button
                    type="button"
                    onClick={() => onDownloadFile(item)}
                    className="px-2.5 py-1.5 rounded-lg bg-accent dark:bg-accent-dark hover:opacity-90 text-white text-[12px] font-medium flex items-center gap-1 transition-all shadow-sm"
                    title="Download Cleaned"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Save</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onRemoveFile(item.id)}
                  className="p-1.5 rounded-lg text-n-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-n-100 dark:hover:bg-white/[0.05] transition-colors"
                  title="Remove from batch"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
