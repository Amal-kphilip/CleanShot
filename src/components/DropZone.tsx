'use client';

import React, { useRef, useState, useEffect } from 'react';
import {
  File as FileIcon,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  Download,
  Upload,
} from 'lucide-react';
import type { FileItemState } from './FileList';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
  disabled?: boolean;
  files?: FileItemState[];
  onRemoveFile?: (id: string) => void;
  onInspectFile?: (file: FileItemState) => void;
  onDownloadFile?: (file: FileItemState) => void;
  maxFiles?: number;
  maxTotalSizeMb?: number;
}

const ACCEPTED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.svg',
  '.pdf',
  '.docx',
  '.mp4',
  '.mov',
  '.webm',
  '.mkv',
  '.mp3',
  '.wav',
  '.flac',
  '.aac',
  '.m4a',
];

const ACCEPTED_EXTENSIONS_LABEL = ACCEPTED_EXTENSIONS.map((ext) =>
  ext.replace(/^\./, '').toUpperCase()
).join(' · ');

export function DropZone({
  onFilesSelected,
  isProcessing,
  disabled,
  files = [],
  onRemoveFile,
  onInspectFile,
  onDownloadFile,
  maxFiles = 150,
  maxTotalSizeMb = 100,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled || isProcessing) return;
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      const pastedFiles: File[] = [];
      for (const item of items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length > 0) onFilesSelected(pastedFiles);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onFilesSelected, disabled, isProcessing]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isProcessing) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled || isProcessing) return;
    if (e.dataTransfer.files?.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || isProcessing) {
      e.target.value = '';
      return;
    }
    if (e.target.files?.length) {
      onFilesSelected(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const queuedSizeMb =
    files.reduce((sum, item) => sum + item.file.size, 0) / (1024 * 1024);

  return (
    <div className="w-full flex flex-col gap-2.5">
      <div
        role="button"
        tabIndex={isProcessing || disabled ? -1 : 0}
        aria-label="Add files: drag and drop, or activate to browse"
        aria-disabled={isProcessing || disabled}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && !disabled && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if ((e.key === 'Enter' || e.key === ' ') && !isProcessing && !disabled) {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`group relative flex flex-col items-center justify-center w-full min-h-64 sm:min-h-72 p-8 sm:p-12 pb-12 gap-5 rounded-2xl border border-[var(--border-subtle)] bg-glass-card shadow-sm transition-all ${
          isDragOver
            ? 'border-emerald-500 bg-emerald-500/[0.04]'
            : 'hover:border-emerald-500/40'
        } ${
          isProcessing || disabled
            ? 'opacity-60 cursor-not-allowed'
            : 'cursor-pointer'
        }`}
      >
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-3.5 rounded-xl border-2 border-dashed transition-colors ${
            isDragOver
              ? 'border-emerald-500'
              : 'border-[var(--border-subtle)] group-hover:border-emerald-500/40'
          }`}
        />

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS.join(',')}
          onChange={handleFileInputChange}
          disabled={isProcessing || disabled}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFileInputChange}
          disabled={isProcessing || disabled}
          className="hidden"
        />

        <div className="relative z-10 flex flex-col items-center gap-2 text-foreground">
          <div className="w-12 h-12 rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-1 group-hover:scale-105 transition-transform">
            <Upload className="w-5 h-5" />
          </div>
          <div className="flex flex-col items-center text-center leading-snug text-[15px] sm:text-[16px] font-semibold">
            <p>
              Drag &amp; drop files, or{' '}
              <span className="text-emerald-600 dark:text-emerald-400 hover:underline">
                click to browse
              </span>
            </p>
          </div>
          <p className="text-[12px] text-text-ter max-w-xl text-center hidden sm:block">
            {ACCEPTED_EXTENSIONS_LABEL}
          </p>
          <button
            type="button"
            disabled={isProcessing || disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (!isProcessing && !disabled) folderInputRef.current?.click();
            }}
            className="text-[12px] font-medium text-text-sec hover:text-foreground underline underline-offset-4 mt-0.5"
          >
            or select a folder
          </button>
        </div>

        {files.length > 0 && (
          <ul
            className="relative z-10 w-full max-w-2xl flex flex-col gap-1.5 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {files.map((item) => {
              const isProcessingItem =
                item.status === 'processing' || item.status === 'inspecting';
              const isDone = item.status === 'completed';
              const isFailed = item.status === 'error';

              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)]/60 hover:bg-glass-hover transition-colors"
                >
                  <FileIcon
                    className="shrink-0 text-text-sec"
                    size={18}
                    strokeWidth={2}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] sm:text-[14px] font-medium text-foreground truncate">
                      {item.result ? item.result.cleanedFilename : item.file.name}
                    </p>
                    {isFailed && item.error && (
                      <p className="text-[11px] text-red-500 truncate">
                        {item.error}
                      </p>
                    )}
                  </div>

                  {onInspectFile && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectFile(item);
                      }}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium text-text-sec hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 inline-flex items-center gap-1 transition-colors"
                      title="Inspect metadata"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Inspect</span>
                    </button>
                  )}

                  {isDone && item.result && onDownloadFile && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadFile(item);
                      }}
                      className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                      title="Download cleaned file"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Save</span>
                    </button>
                  )}

                  {isProcessingItem && (
                    <Loader2 className="shrink-0 w-4 h-4 animate-spin text-emerald-500" />
                  )}
                  {isDone && (
                    <CheckCircle2 className="shrink-0 w-4 h-4 text-emerald-500" />
                  )}
                  {isFailed && (
                    <XCircle className="shrink-0 w-4 h-4 text-red-500" />
                  )}

                  {onRemoveFile && (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFile(item.id);
                      }}
                      aria-label={`Remove ${item.file.name}`}
                      className="p-1 rounded-md text-text-sec hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-[11px] font-medium text-text-ter absolute right-5 bottom-3.5 z-10">
          {`${files.length}/${maxFiles} files · ${queuedSizeMb.toFixed(1)}/${maxTotalSizeMb} MB`}
        </p>
      </div>
    </div>
  );
}
