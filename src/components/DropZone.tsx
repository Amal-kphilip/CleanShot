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
  Plus,
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
    <div className="mx-auto w-full max-w-3xl flex flex-col gap-3">
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
        className={`gwr-checkerboard group relative flex min-h-[280px] sm:min-h-[320px] lg:min-h-[380px] w-full flex-col items-center justify-center overflow-hidden rounded-[20px] sm:rounded-[32px] border-[3px] p-6 sm:p-10 pb-12 gap-5 text-center transition-all duration-300 ease-out shadow-2xl shadow-blue-600/10 ${
          isDragOver
            ? 'border-[#145BF5] ring-4 ring-[#145BF5]/20'
            : 'border-white dark:border-white/10'
        } ${
          isProcessing || disabled
            ? 'opacity-60 cursor-not-allowed'
            : 'cursor-pointer'
        }`}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-white/40 dark:bg-[#141720]/70 backdrop-blur-[2px] transition-opacity group-hover:bg-white/25 dark:group-hover:bg-[#141720]/55"
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
          // @ts-expect-error webkitdirectory is supported in Chromium/WebKit
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFileInputChange}
          disabled={isProcessing || disabled}
          className="hidden"
        />

        <div className="relative z-10 flex flex-col items-center gap-3.5 sm:gap-5 pt-2">
          <span className="flex min-h-[52px] items-center gap-2 sm:gap-3 rounded-[12px] sm:rounded-[14px] bg-[#145BF5] px-8 py-3.5 text-[16px] sm:min-h-[64px] sm:px-[52px] sm:py-[18px] sm:text-[20px] font-semibold text-white transition-colors duration-200 group-hover:bg-[#0F4AD4] shadow-lg shadow-blue-600/20">
            <Plus className="h-5 w-5 sm:h-6 sm:w-6 opacity-85 stroke-[2.5px]" />
            <span>Start with files</span>
          </span>
          <span className="text-base sm:text-[20px] font-extrabold text-foreground tracking-tight">
            or drag files here
          </span>
          <div className="flex flex-col items-center gap-1">
            <p className="text-[11px] font-medium text-text-sec max-w-lg hidden sm:block">
              {ACCEPTED_EXTENSIONS_LABEL}
            </p>
            <button
              type="button"
              disabled={isProcessing || disabled}
              onClick={(e) => {
                e.stopPropagation();
                if (!isProcessing && !disabled) folderInputRef.current?.click();
              }}
              className="text-[12px] font-semibold text-text-sec hover:text-[#145BF5] underline underline-offset-4"
            >
              or select a folder
            </button>
          </div>
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
                  className="flex items-center gap-3 py-2 px-3 rounded-xl border border-[var(--border-subtle)] bg-glass-card/95 shadow-sm transition-colors"
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
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-text-sec hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 inline-flex items-center gap-1 transition-colors"
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
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#145BF5] dark:text-[#60A5FA] hover:underline inline-flex items-center gap-1"
                      title="Download cleaned file"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Save</span>
                    </button>
                  )}

                  {isProcessingItem && (
                    <Loader2 className="shrink-0 w-4 h-4 animate-spin text-[#145BF5]" />
                  )}
                  {isDone && (
                    <CheckCircle2 className="shrink-0 w-4 h-4 text-[#145BF5]" />
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
                      className="p-1 rounded-lg text-text-sec hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-[11px] font-semibold text-text-ter absolute right-6 bottom-3.5 z-10">
          {`${files.length}/${maxFiles} files · ${queuedSizeMb.toFixed(1)}/${maxTotalSizeMb} MB`}
        </p>
      </div>
    </div>
  );
}
