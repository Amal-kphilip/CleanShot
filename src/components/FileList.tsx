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
  Layers,
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
      {/* List Header with prominent action */}
      <div className="flex flex-row items-center justify-between px-1 gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-surface-900 dark:text-white">
            Queue
          </h3>
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-200 dark:bg-surface-800 text-surface-700 dark:text-surface-300">
            {files.length}
          </span>
          {queuedCount > 0 && (
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
              ({queuedCount} ready to clean)
            </span>
          )}
        </div>

        {queuedCount > 0 && onProcessAll && (
          <button
            type="button"
            onClick={onProcessAll}
            disabled={isProcessing}
            className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-xs font-bold shadow-sm shadow-brand-500/20 flex items-center gap-1.5 transition-all"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
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

      {/* Grid of Files */}
      <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
        {files.map((item) => {
          const isCompleted = item.status === 'completed';
          const isProcessingItem = item.status === 'processing' || item.status === 'inspecting';
          const isError = item.status === 'error';

          return (
            <div
              key={item.id}
              className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                isCompleted
                  ? 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800 shadow-sm'
                  : isProcessingItem
                  ? 'bg-brand-50/40 dark:bg-brand-950/30 border-brand-300 dark:border-brand-800 shadow-sm ring-1 ring-brand-500/20'
                  : isError
                  ? 'bg-red-50/30 dark:bg-red-950/20 border-red-200 dark:border-red-900/60'
                  : 'bg-white dark:bg-surface-900 border-surface-200 dark:border-surface-800'
              }`}
            >
              {/* Left: Thumbnail & Details */}
              <div className="flex items-center gap-3 min-w-0 flex-1 w-full sm:w-auto">
                {/* Selection checkbox */}
                <input
                  type="checkbox"
                  checked={item.selected !== false}
                  onChange={() => onToggleSelect(item.id)}
                  className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-surface-300 dark:border-surface-700 dark:bg-surface-800 shrink-0"
                />

                {/* Thumbnail */}
                <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl overflow-hidden bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 shrink-0 flex items-center justify-center">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileImage className="w-5 h-5 text-surface-400" />
                  )}

                  {/* Status Overlay Icon */}
                  {isProcessingItem && (
                    <div className="absolute inset-0 bg-brand-950/60 backdrop-blur-[1px] flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
                    </div>
                  )}
                </div>

                {/* File Metadata & Badges */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className="text-xs sm:text-sm font-semibold text-surface-900 dark:text-white truncate max-w-[180px] sm:max-w-xs md:max-w-md">
                      {item.file.name}
                    </span>
                    <span className="text-[9px] sm:text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-700">
                      {item.result?.format || item.file.name.split('.').pop() || 'IMG'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs text-surface-500 dark:text-surface-400 flex-wrap">
                    <span>{formatBytes(item.file.size)}</span>

                    {item.result && item.result.bytesSaved > 0 && (
                      <>
                        <span>&rarr;</span>
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          {formatBytes(item.result.cleanedSize)} (-{formatBytes(item.result.bytesSaved)})
                        </span>
                      </>
                    )}

                    {/* Sensitive Data Detected Badges */}
                    {item.metadata?.gps && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                        <MapPin className="w-2.5 h-2.5" /> GPS
                      </span>
                    )}

                    {item.metadata?.categories.camera ? (
                      <span className="inline-flex items-center gap-0.5 text-[9px] sm:text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-700">
                        <Camera className="w-2.5 h-2.5" /> EXIF
                      </span>
                    ) : null}

                    {/* Status badges */}
                    {item.status === 'queued' && (
                      <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        Ready to clean
                      </span>
                    )}

                    {/* Pixel-identical badge */}
                    {isCompleted && item.result?.pixelIdentical && (
                      <span
                        className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                        title="Zero quality loss: Original DCT coefficients and pixel values 100% untouched"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Pixel-identical &check;
                      </span>
                    )}
                  </div>

                  {/* Per-file Progress Bar */}
                  {isProcessingItem && (
                    <div className="w-full max-w-xs h-1.5 bg-surface-200 dark:bg-surface-800 rounded-full overflow-hidden mt-1">
                      <div
                        className="h-full bg-brand-500 transition-all duration-300"
                        style={{ width: `${item.progress}%` }}
                      ></div>
                    </div>
                  )}

                  {isError && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {item.error || 'Failed to process file'}
                    </p>
                  )}
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-surface-100 dark:border-surface-800">
                {/* Inspect Metadata Button */}
                <button
                  type="button"
                  onClick={() => onInspectFile(item)}
                  className="px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-surface-700 dark:text-surface-300 text-xs font-semibold border border-surface-200 dark:border-surface-700 flex items-center gap-1 transition-colors"
                  title="Inspect Metadata Details"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect</span>
                </button>

                {/* Download Single Cleaned File */}
                {isCompleted && item.result && (
                  <button
                    type="button"
                    onClick={() => onDownloadFile(item)}
                    className="px-2.5 sm:px-3 py-1.5 rounded-lg sm:rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1 transition-colors"
                    title="Download Cleaned Image"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                )}

                {/* Remove from queue */}
                <button
                  type="button"
                  onClick={() => onRemoveFile(item.id)}
                  className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-surface-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
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
