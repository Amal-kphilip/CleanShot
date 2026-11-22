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
  cleanedMetadata?: ParsedMetadata;
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

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const FileListRow = React.memo(function FileListRow({
  item,
  isProcessing,
  showSpinner,
  onToggleSelect,
  onInspectFile,
  onDownloadFile,
  onRemoveFile,
}: {
  item: FileItemState;
  isProcessing?: boolean;
  showSpinner: boolean;
  onToggleSelect: (id: string) => void;
  onInspectFile: (file: FileItemState) => void;
  onDownloadFile: (file: FileItemState) => void;
  onRemoveFile: (id: string) => void;
}) {
  const isCompleted = item.status === 'completed';
  const isProcessingItem =
    item.status === 'processing' || item.status === 'inspecting';
  const isError = item.status === 'error';
  const progressRatio = Math.max(0.08, Math.min(1, (item.progress || 10) / 100));

  return (
    <div
      className={`group relative flex flex-col sm:flex-row items-start sm:items-center gap-3.5 p-3.5 sm:p-4 rounded-card border transition-colors ${
        isProcessingItem
          ? 'border-accent/40 bg-accent-light shadow-sm'
          : isError
          ? 'border-red-500/30 bg-red-500/[0.04]'
          : 'liquid-glass hover:border-black/[0.12] dark:hover:border-white/[0.14]'
      }`}
    >
      {/* Left: Checkbox + Thumbnail + Details */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1 w-full sm:w-auto">
        <input
          type="checkbox"
          checked={item.selected !== false}
          onChange={() => onToggleSelect(item.id)}
          disabled={Boolean(isProcessing)}
          className="w-4 h-4 rounded text-accent focus:ring-accent border-border-subtle bg-transparent shrink-0"
        />

        <div className="relative w-12 h-12 rounded-small overflow-hidden bg-black/[0.04] dark:bg-white/[0.05] border border-border-subtle shrink-0 flex items-center justify-center">
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt={item.file.name}
              decoding="async"
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <FileImage className="w-5 h-5 text-text-ter" />
          )}
          {isProcessingItem && showSpinner && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
          )}
          {isCompleted && (
            <div className="absolute inset-0 bg-emerald-950/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[13px] sm:text-[14px] font-semibold text-foreground truncate max-w-[180px] sm:max-w-[260px] md:max-w-md">
              {item.result ? item.result.cleanedFilename : item.file.name}
            </span>
            {item.result && item.result.cleanedFilename !== item.file.name && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-pill bg-accent-light text-accent border border-accent/20">
                Renamed
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 text-[12px] text-text-sec flex-wrap">
            <span>{formatBytes(item.file.size)}</span>

            {item.result && item.result.bytesSaved !== 0 && (
              <>
                <span className="text-text-ter">→</span>
                <span
                  className={`font-medium ${
                    item.result.bytesSaved > 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {item.result.bytesSaved > 0 ? '−' : '+'}
                  {formatBytes(Math.abs(item.result.bytesSaved))}
                </span>
              </>
            )}

            {item.status === 'queued' && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                <span className="text-text-ter">queued</span>
              </span>
            )}
            {isProcessingItem && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-accent inline-block" />
                <span>processing</span>
              </span>
            )}
            {isCompleted && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                <span className="text-emerald-600 dark:text-emerald-400">
                  cleaned
                </span>
              </span>
            )}

            {item.metadata?.gps && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-pill bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40">
                <MapPin className="w-2.5 h-2.5" /> GPS
              </span>
            )}
            {item.metadata?.categories.camera && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-pill bg-black/[0.03] dark:bg-white/[0.05] text-text-ter border border-border-subtle">
                <Camera className="w-2.5 h-2.5" /> EXIF
              </span>
            )}
          </div>

          {isProcessingItem && (
            <div className="w-full max-w-[200px] h-1 bg-black/[0.06] dark:bg-white/[0.08] rounded-pill overflow-hidden mt-1.5">
              <div
                className="h-full w-full origin-left bg-accent rounded-pill transition-transform duration-150 ease-out will-change-transform"
                style={{ transform: `scaleX(${progressRatio})` }}
                role="progressbar"
                aria-label={`Processing ${item.file.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progressRatio * 100)}
              />
            </div>
          )}

          {isError && (
            <p className="text-[12px] text-red-600 dark:text-red-400 flex items-start gap-1 mt-1 min-w-0 break-words">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span className="min-w-0 break-words">
                {item.error || 'Failed to process'}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      <div className="file-item-actions flex items-center gap-2 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-border-subtle">
        <button
          type="button"
          onClick={() => onInspectFile(item)}
          className="px-3 py-1.5 rounded-pill liquid-glass hover:bg-glass-hover text-foreground text-[12px] font-medium flex items-center gap-1.5 transition-colors"
          title="Inspect Metadata"
        >
          <Eye className="w-3.5 h-3.5 text-text-sec" />
          <span>Inspect</span>
        </button>

        {isCompleted && item.result && (
          <button
            type="button"
            onClick={() => onDownloadFile(item)}
            className="px-3 py-1.5 rounded-pill bg-accent hover:bg-accent-hover text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
            title="Download Cleaned"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onRemoveFile(item.id)}
          disabled={Boolean(isProcessing)}
          aria-label={`Remove ${item.file.name} from batch`}
          className="p-2 rounded-pill text-text-ter hover:text-red-500 hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Remove from batch"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

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
  let activeSpinners = 0;

  return (
    <div className="space-y-3.5 w-full">
      {/* List Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2.5">
          <h3 className="text-[14px] font-semibold text-foreground">Queue</h3>
          <span className="px-2 py-0.5 rounded-pill text-[11px] font-semibold bg-black/[0.04] dark:bg-white/[0.08] text-text-sec">
            {files.length}
          </span>
          {queuedCount > 0 && (
            <span className="text-[12px] font-medium text-text-ter">
              {queuedCount} ready
            </span>
          )}
          {completedCount > 0 && (
            <span className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
              {completedCount} cleaned
            </span>
          )}
        </div>

        {queuedCount > 0 && onProcessAll && (
          <button
            type="button"
            onClick={onProcessAll}
            disabled={isProcessing}
            className="px-4 py-2 rounded-pill bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 active:scale-[0.97] text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-accent-button apple-spring disabled:opacity-50 disabled:cursor-not-allowed"
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
      <div className="space-y-2.5">
        {files.map((item) => {
          const isProcessingItem =
            item.status === 'processing' || item.status === 'inspecting';
          const showSpinner = isProcessingItem && activeSpinners < 4;
          if (showSpinner) activeSpinners++;

          return (
            <FileListRow
              key={item.id}
              item={item}
              isProcessing={isProcessing}
              showSpinner={showSpinner}
              onToggleSelect={onToggleSelect}
              onInspectFile={onInspectFile}
              onDownloadFile={onDownloadFile}
              onRemoveFile={onRemoveFile}
            />
          );
        })}
      </div>
    </div>
  );
}
