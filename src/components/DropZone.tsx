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
  Archive,
} from 'lucide-react';
import type { FileItemState } from './FileList';

export interface ZipExtractionStatus {
  archiveName: string;
  extractedCount: number;
  processedEntries: number;
  totalEntries: number;
  completed?: boolean;
}

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
  zipExtractionStatus?: ZipExtractionStatus | null;
  onCancelZipExtraction?: () => void;
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
  '.zip',
];

const PHOTO_VIDEO_ACCEPT = 'image/*,video/*';

const SECONDARY_ACCEPT = [
  '.zip',
  'application/zip',
  'application/x-zip-compressed',
  '.pdf',
  'application/pdf',
  '.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'audio/*',
].join(',');

const ACCEPTED_EXTENSIONS_LABEL = ACCEPTED_EXTENSIONS.map((ext) =>
  ext.replace(/^\./, '').toUpperCase()
).join(' · ');

const DropZoneFileRow = React.memo(function DropZoneFileRow({
  item,
  isProcessing,
  showSpinner,
  onInspectFile,
  onDownloadFile,
  onRemoveFile,
}: {
  item: FileItemState;
  isProcessing: boolean;
  showSpinner: boolean;
  onInspectFile?: (file: FileItemState) => void;
  onDownloadFile?: (file: FileItemState) => void;
  onRemoveFile?: (id: string) => void;
}) {
  const isProcessingItem =
    item.status === 'processing' || item.status === 'inspecting';
  const isDone = item.status === 'completed';
  const isFailed = item.status === 'error';

  return (
    <li className="flex items-center gap-3 py-2 px-3 rounded-xl border border-[var(--border-subtle)] bg-glass-card shadow-sm transition-colors">
      <FileIcon className="shrink-0 text-text-sec" size={18} strokeWidth={2} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] sm:text-[14px] font-medium text-foreground truncate">
          {item.result ? item.result.cleanedFilename : item.file.name}
        </p>
        {isFailed && item.error && (
          <p className="text-[11px] text-red-500 truncate">{item.error}</p>
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
        showSpinner ? (
          <Loader2 className="shrink-0 w-4 h-4 animate-spin text-[#145BF5]" />
        ) : (
          <span
            aria-label="Queued for processing"
            className="shrink-0 w-2.5 h-2.5 rounded-full bg-[#145BF5]/70"
          />
        )
      )}
      {isDone && <CheckCircle2 className="shrink-0 w-4 h-4 text-[#145BF5]" />}
      {isFailed && <XCircle className="shrink-0 w-4 h-4 text-red-500" />}

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
});

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
  zipExtractionStatus,
  onCancelZipExtraction,
}: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const photoVideoInputRef = useRef<HTMLInputElement>(null);
  const secondaryInputRef = useRef<HTMLInputElement>(null);
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
    const selected = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (disabled || isProcessing) return;
    if (selected.length > 0) {
      onFilesSelected(selected);
    }
  };

  const queuedSizeMb =
    files.reduce((sum, item) => sum + item.file.size, 0) / (1024 * 1024);

  let activeSpinners = 0;
  const maxSimultaneousSpinners = 4;

  const extractionRatio =
    zipExtractionStatus && zipExtractionStatus.totalEntries > 0
      ? Math.max(
          0,
          Math.min(
            1,
            zipExtractionStatus.processedEntries / zipExtractionStatus.totalEntries
          )
        )
      : 0;

  return (
    <div className="mx-auto w-full max-w-3xl flex flex-col gap-3">
      {zipExtractionStatus && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-2xl border border-[var(--border-subtle)] bg-glass-card p-4 shadow-sm space-y-2.5"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Loader2 className="w-4 h-4 shrink-0 animate-spin text-[#145BF5]" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-foreground truncate">
                  Extracting files from ZIP...
                </p>
                <p className="text-[11px] text-text-sec truncate">
                  {zipExtractionStatus.archiveName} ·{' '}
                  {zipExtractionStatus.extractedCount}{' '}
                  {zipExtractionStatus.extractedCount === 1 ? 'file' : 'files'} extracted ·{' '}
                  {zipExtractionStatus.processedEntries}/{zipExtractionStatus.totalEntries}{' '}
                  entries processed
                </p>
              </div>
            </div>
            {onCancelZipExtraction && (
              <button
                type="button"
                onClick={onCancelZipExtraction}
                className="px-2.5 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] text-[11px] font-semibold text-text-sec hover:text-foreground transition-colors shrink-0"
              >
                Cancel
              </button>
            )}
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(extractionRatio * 100)}
            className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-elevated)]"
          >
            <div
              className="h-full w-full origin-left bg-[#145BF5] transition-transform duration-150 ease-out will-change-transform"
              style={{ transform: `scaleX(${extractionRatio})` }}
            />
          </div>
        </div>
      )}

      <div
        role="button"
        tabIndex={isProcessing || disabled ? -1 : 0}
        aria-label="Add photos and videos: drag and drop, or activate to browse"
        aria-disabled={isProcessing || disabled}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() =>
          !isProcessing && !disabled && photoVideoInputRef.current?.click()
        }
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if ((e.key === 'Enter' || e.key === ' ') && !isProcessing && !disabled) {
            e.preventDefault();
            photoVideoInputRef.current?.click();
          }
        }}
        className={`gwr-checkerboard group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-[20px] sm:rounded-[32px] border-[3px] p-4 sm:p-10 gap-4 sm:gap-5 text-center transition-colors duration-200 shadow-lg sm:shadow-2xl shadow-blue-600/10 ${
          files.length > 0
            ? 'min-h-[160px] sm:min-h-[180px] pb-6 sm:pb-10'
            : 'min-h-[230px] sm:min-h-[320px] lg:min-h-[380px] pb-8 sm:pb-12'
        } ${
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
          className="absolute inset-0 bg-white/55 dark:bg-[#141720]/75 sm:backdrop-blur-[2px] transition-opacity group-hover:bg-white/35 dark:group-hover:bg-[#141720]/60"
        />

        {/* Primary hidden input: Photos & Videos only (native mobile gallery picker) */}
        <input
          ref={photoVideoInputRef}
          type="file"
          multiple
          accept={PHOTO_VIDEO_ACCEPT}
          onChange={handleFileInputChange}
          disabled={isProcessing || disabled}
          className="hidden"
        />

        {/* Secondary hidden input: ZIP archives, Documents (PDF/DOCX) & Audio */}
        <input
          ref={secondaryInputRef}
          type="file"
          multiple
          accept={SECONDARY_ACCEPT}
          onChange={handleFileInputChange}
          disabled={isProcessing || disabled}
          className="hidden"
        />

        {/* Folder hidden input */}
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

        <div className="relative z-10 flex flex-col items-center gap-3 sm:gap-4 pt-2">
          <button
            type="button"
            disabled={isProcessing || disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (!isProcessing && !disabled) {
                photoVideoInputRef.current?.click();
              }
            }}
            className="flex min-h-[52px] items-center gap-2 sm:gap-3 rounded-[12px] sm:rounded-[14px] bg-[#145BF5] px-7 py-3.5 text-[15px] sm:min-h-[60px] sm:px-11 sm:py-4 sm:text-[18px] font-semibold text-white transition-colors duration-200 hover:bg-[#0F4AD4] shadow-md shadow-blue-600/20 disabled:opacity-50"
          >
            <Plus className="h-5 w-5 sm:h-6 sm:w-6 opacity-85 stroke-[2.5px]" />
            <span>Select Photos &amp; Videos</span>
          </button>

          <button
            type="button"
            disabled={isProcessing || disabled}
            onClick={(e) => {
              e.stopPropagation();
              if (!isProcessing && !disabled) {
                secondaryInputRef.current?.click();
              }
            }}
            className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-glass-card px-4 py-2 text-[12px] sm:text-[13px] font-semibold text-text-sec hover:text-foreground hover:border-[#145BF5]/40 transition-colors shadow-sm disabled:opacity-50"
          >
            <Archive className="h-3.5 w-3.5 text-[#145BF5] shrink-0" />
            <span>Upload ZIP Archive, Documents &amp; Audio</span>
          </button>

          <span className="text-sm sm:text-[18px] font-extrabold text-foreground tracking-tight">
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
              const showSpinner =
                isProcessingItem && activeSpinners < maxSimultaneousSpinners;
              if (showSpinner) activeSpinners++;

              return (
                <DropZoneFileRow
                  key={item.id}
                  item={item}
                  isProcessing={isProcessing}
                  showSpinner={showSpinner}
                  onInspectFile={onInspectFile}
                  onDownloadFile={onDownloadFile}
                  onRemoveFile={onRemoveFile}
                />
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
