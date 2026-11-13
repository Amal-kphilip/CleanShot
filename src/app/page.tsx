'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Header } from '@/components/Header';
import { DropZone } from '@/components/DropZone';
import { FileItemState } from '@/components/FileList';
import { StripOptions } from '@/lib/engine/types';
import {
  processBatchWithConcurrency,
  createThumbnail,
  inspectFileInWorker,
} from '@/lib/worker/workerRunner';
import { createZipArchive, triggerDownload } from '@/lib/zip/clientZip';
import { useDialogAccessibility } from '@/lib/ui/useDialogAccessibility';
import { Loader2, Copy, Check, Bookmark, Download, ShieldCheck, Sparkles } from 'lucide-react';

const InspectorModal = dynamic(
  () => import('@/components/InspectorModal').then((mod) => mod.InspectorModal),
  { ssr: false }
);
const SettingsModal = dynamic(
  () => import('@/components/SettingsModal').then((mod) => mod.SettingsModal),
  { ssr: false }
);

const MAX_CLIENT_FILES = 150;
const MAX_CLIENT_FILE_BYTES = 50 * 1024 * 1024;
const MAX_CLIENT_BATCH_BYTES = 100 * 1024 * 1024;

export default function HomePage() {
  const [files, setFiles] = useState<FileItemState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [batchError, setBatchError] = useState('');
  const [copied, setCopied] = useState(false);
  const [bookmarkNote, setBookmarkNote] = useState(false);
  const [options, setOptions] = useState<StripOptions>({
    keepIccProfile: false,
    keepOrientation: false,
    stripAll: true,
    filenameSuffix: '_clean',
    preserveFolderStructure: false,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [inspectItem, setInspectItem] = useState<FileItemState | null>(null);
  const objectUrls = useRef(new Set<string>());
  const clearDialogRef = useRef<HTMLDivElement>(null);
  const closeClearConfirm = useCallback(() => setIsClearConfirmOpen(false), []);
  useDialogAccessibility(isClearConfirmOpen, closeClearConfirm, clearDialogRef);

  useEffect(
    () => () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current.clear();
    },
    []
  );

  const revokeThumbnail = (item: FileItemState) => {
    if (item.thumbnailUrl && objectUrls.current.has(item.thumbnailUrl)) {
      URL.revokeObjectURL(item.thumbnailUrl);
      objectUrls.current.delete(item.thumbnailUrl);
    }
  };

  const handleFilesSelected = useCallback(
    async (newFiles: File[]) => {
      if (isProcessing) return;
      setBatchError('');
      let queuedBytes = files.reduce((total, item) => total + item.file.size, 0);
      const acceptedFiles: File[] = [];
      const rejected: string[] = [];

      for (const file of newFiles) {
        if (file.size > MAX_CLIENT_FILE_BYTES) {
          rejected.push(`${file.name} (over 50 MB)`);
          continue;
        }
        if (files.length + acceptedFiles.length >= MAX_CLIENT_FILES) {
          rejected.push(`${file.name} (queue limit: ${MAX_CLIENT_FILES} files)`);
          continue;
        }
        if (queuedBytes + file.size > MAX_CLIENT_BATCH_BYTES) {
          rejected.push(`${file.name} (batch limit: 100 MB)`);
          continue;
        }
        acceptedFiles.push(file);
        queuedBytes += file.size;
      }

      if (rejected.length) {
        setBatchError(
          `Some files were not added. Limits: 50 MB per file, 100 MB total queue, and ${MAX_CLIENT_FILES} files. Rejected: ${rejected
            .slice(0, 4)
            .join(', ')}${rejected.length > 4 ? `, and ${rejected.length - 4} more` : ''}.`
        );
      }
      if (!acceptedFiles.length) return;

      const initialItems: FileItemState[] = acceptedFiles.map((file) => {
        const thumbnailUrl = createThumbnail(file);
        if (thumbnailUrl) objectUrls.current.add(thumbnailUrl);
        return {
          id: crypto.randomUUID(),
          file,
          relativePath:
            (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
            file.name,
          thumbnailUrl,
          status: 'queued',
          progress: 0,
          selected: true,
        };
      });

      setFiles((prev) => [...prev, ...initialItems]);

      for (const item of initialItems) {
        try {
          const meta = await inspectFileInWorker(item.file, item.id);
          setFiles((prev) =>
            prev.map((file) =>
              file.id === item.id ? { ...file, metadata: meta } : file
            )
          );
        } catch {
          // Unsupported or malformed files remain queued and receive an error on processing.
        }
      }
    },
    [files, isProcessing]
  );

  const handleDownloadSingle = useCallback((item: FileItemState) => {
    if (!item.result || item.status !== 'completed') return;
    try {
      if (!item.result.cleanedBuffer.length)
        throw new Error(
          'No cleaned file data is available. Please process this file again.'
        );
      const cleanedCopy = new Uint8Array(item.result.cleanedBuffer.byteLength);
      cleanedCopy.set(item.result.cleanedBuffer);
      triggerDownload(
        new Blob([cleanedCopy.buffer], { type: item.result.mimeType }),
        item.result.cleanedFilename
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not download the cleaned file.';
      setFiles((prev) =>
        prev.map((file) =>
          file.id === item.id ? { ...file, error: message } : file
        )
      );
      setBatchError(message);
    }
  }, []);

  const downloadReadyItems = useCallback(
    (readyFiles: FileItemState[]) => {
      if (!readyFiles.length) return;
      try {
        if (readyFiles.length === 1) {
          handleDownloadSingle(readyFiles[0]);
          return;
        }
        const zipInputs = readyFiles.map((file) => {
          const buffer = file.result!.cleanedBuffer;
          if (!buffer.length)
            throw new Error(
              `${file.file.name} has no cleaned data. Please process it again.`
            );
          return {
            name: file.result!.cleanedFilename,
            data: buffer,
            path: options.preserveFolderStructure
              ? file.relativePath
              : undefined,
          };
        });
        triggerDownload(
          createZipArchive(zipInputs, options.preserveFolderStructure),
          `cleanshot_cleaned_${Date.now()}.zip`
        );
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not create the download.';
        setBatchError(message);
      }
    },
    [handleDownloadSingle, options.preserveFolderStructure]
  );

  const handleProcessAll = useCallback(async () => {
    if (isProcessing || files.length === 0) return;
    const queuedItems = files.filter(
      (file) =>
        file.selected !== false &&
        (file.status === 'queued' || file.status === 'error')
    );

    // If all files are already completed, trigger download directly
    if (!queuedItems.length) {
      const completed = files.filter(
        (file) =>
          file.selected !== false && file.status === 'completed' && file.result
      );
      if (completed.length > 0) {
        downloadReadyItems(completed);
      }
      return;
    }

    setBatchError('');
    setIsProcessing(true);
    const queuedIds = new Set(queuedItems.map((item) => item.id));
    const newlyCompleted: FileItemState[] = [];

    try {
      const tasks = queuedItems.map((item) => ({
        id: item.id,
        file: item.file,
        relativePath: item.relativePath,
        options,
        metadata: item.metadata,
      }));
      await processBatchWithConcurrency(
        tasks,
        Math.min(
          3,
          Math.max(
            1,
            typeof navigator !== 'undefined'
              ? (navigator.hardwareConcurrency || 2) - 1
              : 2
          )
        ),
        (id) =>
          setFiles((prev) =>
            prev.map((file) =>
              file.id === id
                ? { ...file, status: 'processing', progress: 5, error: undefined }
                : file
            )
          ),
        (output) => {
          const target = queuedItems.find((f) => f.id === output.id);
          if (target && !output.result.error) {
            newlyCompleted.push({
              ...target,
              status: 'completed',
              progress: 100,
              result: output.result,
              cleanedMetadata: output.cleanedMetadata,
            });
          }
          setFiles((prev) =>
            prev.map((file) =>
              file.id === output.id
                ? {
                    ...file,
                    status: output.result.error ? 'error' : 'completed',
                    progress: output.result.error ? 0 : 100,
                    result: output.result.error ? undefined : output.result,
                    metadata: output.metadata || file.metadata,
                    cleanedMetadata: output.result.error
                      ? undefined
                      : output.cleanedMetadata,
                    error: output.result.error,
                  }
                : file
            )
          );
        },
        (id, error) =>
          setFiles((prev) =>
            prev.map((file) =>
              file.id === id
                ? { ...file, status: 'error', error, progress: 0 }
                : file
            )
          ),
        (id, progress) =>
          setFiles((prev) =>
            prev.map((file) =>
              file.id === id ? { ...file, progress } : file
            )
          )
      );

      if (newlyCompleted.length > 0) {
        downloadReadyItems(newlyCompleted);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Processing failed. Please try again.';
      setBatchError(message);
      setFiles((prev) =>
        prev.map((file) =>
          queuedIds.has(file.id) &&
          (file.status === 'queued' || file.status === 'processing')
            ? { ...file, status: 'error', error: message, progress: 0 }
            : file
        )
      );
    } finally {
      setIsProcessing(false);
    }
  }, [downloadReadyItems, files, options, isProcessing]);

  const handleRemoveFile = (id: string) => {
    const item = files.find((file) => file.id === id);
    if (item) revokeThumbnail(item);
    setFiles((prev) => prev.filter((file) => file.id !== id));
    if (inspectItem?.id === id) setInspectItem(null);
  };

  const handleClearAll = () => {
    if (isProcessing) return;
    files.forEach(revokeThumbnail);
    setFiles([]);
    setBatchError('');
    setInspectItem(null);
  };

  const shareUrl =
    typeof window !== 'undefined' ? window.location.origin : 'https://cleanshot.app/';

  const openShare = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard failures
    }
  };

  const hasQueued = files.some(
    (f) => f.status === 'queued' || f.status === 'error'
  );
  const completedFiles = files.filter(
    (f) => f.status === 'completed' && f.result
  );

  return (
    <div className="flex flex-col flex-1 w-full">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="flex-1 w-full flex flex-col gap-7 sm:gap-9 pb-10">
        {/* Hero */}
        <section className="pt-4 sm:pt-10 lg:pt-12 pb-1 text-center">
          <div className="mx-auto max-w-4xl">
            <h1 className="text-[28px] sm:text-[44px] md:text-[48px] lg:text-[54px] font-extrabold tracking-tight text-foreground leading-tight">
              Lossless Metadata Remover
            </h1>
            <p className="mx-auto mt-2.5 sm:mt-5 max-w-[640px] text-[14px] sm:text-[17px] md:text-[18px] leading-[1.6] text-text-sec font-medium">
              Free online metadata cleaner for photos, PDFs, documents, audio, and video.
              <br className="hidden sm:block" /> No upload, no sign-up — 100% local, private processing.
            </p>
          </div>
        </section>

        {/* Segmented pill switcher matching geminiwatermarkremover.io */}
        <div className="flex justify-center">
          <div className="grid w-full max-w-sm grid-cols-2 sm:inline-flex sm:w-auto sm:max-w-none rounded-[1.15rem] bg-slate-900/[0.05] dark:bg-white/[0.07] p-[3px]">
            <span className="inline-flex h-10 min-w-0 sm:min-w-[130px] items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-glass-card px-2.5 sm:px-4 text-[13px] sm:text-[14px] font-semibold text-foreground shadow-sm">
              <ShieldCheck className="h-4 w-4 shrink-0 text-[#145BF5]" />
              <span className="truncate">Metadata</span>
            </span>
            <Link
              href="/gemini-watermark-remover"
              className="group inline-flex h-10 min-w-0 sm:min-w-[140px] items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-2.5 sm:px-4 text-[13px] sm:text-[14px] font-medium text-text-sec transition-all hover:text-foreground"
            >
              <Sparkles className="h-4 w-4 shrink-0 text-text-ter group-hover:text-[#145BF5] transition-colors" />
              <span className="truncate">Watermark</span>
              <span className="hidden xs:inline sm:inline rounded bg-blue-50 dark:bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-[#145BF5] dark:text-[#60A5FA]">
                AI
              </span>
            </Link>
          </div>
        </div>

        {batchError && (
          <div
            role="alert"
            className="mx-auto w-full max-w-3xl flex items-start justify-between gap-3 p-4 rounded-2xl border border-red-500/40 bg-red-500/10 text-[13px] text-foreground"
          >
            <span>{batchError}</span>
            <button
              type="button"
              onClick={() => setBatchError('')}
              aria-label="Dismiss error"
              className="font-bold text-lg leading-none px-1"
            >
              ×
            </button>
          </div>
        )}

        {/* Dropzone + Bottom Action Row */}
        <div className="mx-auto w-full max-w-3xl flex flex-col gap-4">
          <DropZone
            onFilesSelected={handleFilesSelected}
            isProcessing={isProcessing}
            disabled={isProcessing}
            files={files}
            onRemoveFile={handleRemoveFile}
            onInspectFile={setInspectItem}
            onDownloadFile={handleDownloadSingle}
            maxFiles={MAX_CLIENT_FILES}
            maxTotalSizeMb={100}
          />

          <div className="w-full grid grid-cols-2 sm:flex sm:justify-end items-center gap-2.5 sm:gap-3">
            <button
              type="button"
              disabled={files.length <= 0 || isProcessing}
              onClick={() => setIsClearConfirmOpen(true)}
              className="min-h-[44px] px-4 py-2.5 rounded-xl border border-[var(--border-subtle)] bg-glass-card text-[13px] font-semibold text-text-sec hover:text-foreground hover:bg-glass-hover transition-colors inline-flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Clear all
            </button>

            {!hasQueued && completedFiles.length > 0 ? (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => downloadReadyItems(completedFiles)}
                className="min-h-[44px] px-4 sm:px-6 py-2.5 rounded-xl bg-[#145BF5] hover:bg-[#0F4AD4] text-white shadow-sm text-[13px] sm:text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span className="truncate">
                  {completedFiles.length === 1
                    ? 'Download cleaned'
                    : `Download ZIP (${completedFiles.length})`}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={files.length <= 0 || isProcessing}
                onClick={handleProcessAll}
                className="min-h-[44px] px-4 sm:px-6 py-2.5 rounded-xl bg-[#145BF5] hover:bg-[#0F4AD4] text-white shadow-sm text-[13px] sm:text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                <span>Remove metadata</span>
              </button>
            )}
          </div>
        </div>

        {/* Share & Bookmark section */}
        <div className="mx-auto w-full max-w-3xl rounded-2xl border border-[var(--border-subtle)] bg-glass-card p-5 sm:p-6 shadow-sm flex flex-col gap-4 text-[14px]">
          {/* Social sharing */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <span className="w-44 lg:w-52 font-semibold text-[13px] text-text-sec">
              Sharing is caring
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() =>
                  openShare(
                    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                      shareUrl
                    )}`
                  )
                }
                aria-label="Share on Facebook"
                className="h-9 px-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-emerald-500/40 text-foreground text-[12px] font-medium inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span>Facebook</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  openShare(
                    `https://twitter.com/intent/tweet?url=${encodeURIComponent(
                      shareUrl
                    )}`
                  )
                }
                aria-label="Share on Twitter"
                className="h-9 px-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-emerald-500/40 text-foreground text-[12px] font-medium inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span>Twitter</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  openShare(
                    `https://www.reddit.com/submit?url=${encodeURIComponent(
                      shareUrl
                    )}`
                  )
                }
                aria-label="Share on Reddit"
                className="h-9 px-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-emerald-500/40 text-foreground text-[12px] font-medium inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span>Reddit</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  openShare(
                    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                      shareUrl
                    )}`
                  )
                }
                aria-label="Share on LinkedIn"
                className="h-9 px-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-emerald-500/40 text-foreground text-[12px] font-medium inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span>LinkedIn</span>
              </button>
            </div>
          </div>

          {/* Link to this tool */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <span className="w-44 lg:w-52 font-semibold text-[13px] text-text-sec">
              Link to this tool
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="group sm:w-1/2 sm:max-w-sm flex items-stretch rounded-lg border border-[var(--border-subtle)] overflow-hidden bg-[var(--surface-elevated)] text-left cursor-pointer hover:border-emerald-500/40 transition-colors"
              aria-label="Copy link to this tool"
            >
              <span className="h-9 px-3 flex-1 inline-flex items-center text-[12px] font-medium text-foreground truncate">
                {shareUrl}
              </span>
              <span className="h-9 px-3.5 inline-flex items-center justify-center border-l border-[var(--border-subtle)] bg-glass-card group-hover:bg-glass-hover transition-colors text-foreground">
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </span>
            </button>
          </div>

          {/* Bookmark */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <span className="w-44 lg:w-52 font-semibold text-[13px] text-text-sec">
              Come back!
            </span>
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
              <button
                type="button"
                onClick={() => setBookmarkNote(true)}
                className="h-9 px-4 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] hover:border-emerald-500/40 text-foreground text-[12px] font-medium inline-flex items-center gap-2 transition-colors"
              >
                <Bookmark className="w-4 h-4" />
                <span>Bookmark page</span>
              </button>
              {bookmarkNote && (
                <span className="text-[12px] text-text-sec">
                  Press Ctrl+D (or Cmd+D on Mac) to bookmark.
                </span>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-glass-card -mx-5 sm:-mx-6 md:-mx-8 px-5 sm:px-6 md:px-8 py-8 mt-auto border-t border-[var(--border-subtle)]">
        <div className="w-full flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center text-[12px] font-medium text-text-sec">
          <p>CleanShot — Built for everyday digital hygiene.</p>
          <div className="flex items-center gap-5 flex-wrap">
            <Link
              href="/gemini-watermark-remover"
              className="hover:text-foreground transition-colors"
            >
              Watermark Remover
            </Link>
            <Link
              href="/how-it-works"
              className="hover:text-foreground transition-colors"
            >
              How it works
            </Link>
            <Link
              href="/inspector"
              className="hover:text-foreground transition-colors"
            >
              Inspector
            </Link>
            <Link
              href="/formats"
              className="hover:text-foreground transition-colors"
            >
              Formats
            </Link>
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/faq"
              className="hover:text-foreground transition-colors"
            >
              FAQ
            </Link>
          </div>
        </div>
      </footer>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        options={options}
        onChangeOptions={setOptions}
      />

      {isClearConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsClearConfirmOpen(false);
          }}
        >
          <div
            ref={clearDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-all-dialog-title"
            tabIndex={-1}
            className="w-full max-w-md border border-[var(--border-subtle)] rounded-2xl bg-glass-card shadow-floating p-6 flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1">
              <h3
                id="clear-all-dialog-title"
                className="text-[16px] font-semibold text-foreground leading-none"
              >
                Clear all files?
              </h3>
              <p className="text-[13px] text-text-sec mt-1">
                Are you sure you want to clear all files? This can&apos;t be
                undone.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsClearConfirmOpen(false)}
                className="px-4 py-2 text-[12px] font-semibold rounded-lg border border-[var(--border-subtle)] bg-glass-card text-foreground hover:bg-glass-hover transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleClearAll();
                  setIsClearConfirmOpen(false);
                }}
                className="px-4 py-2 text-[12px] font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
      <InspectorModal
        isOpen={Boolean(inspectItem)}
        onClose={() => setInspectItem(null)}
        metadata={
          files.find((file) => file.id === inspectItem?.id)?.metadata ||
          inspectItem?.metadata
        }
        cleanedMetadata={
          files.find((file) => file.id === inspectItem?.id)?.cleanedMetadata
        }
        isProcessed={files.some(
          (file) => file.id === inspectItem?.id && file.status === 'completed'
        )}
        processingError={
          files.find((file) => file.id === inspectItem?.id)?.error
        }
        filename={inspectItem?.file.name || ''}
        thumbnailUrl={
          files.find((file) => file.id === inspectItem?.id)?.thumbnailUrl ||
          inspectItem?.thumbnailUrl
        }
        file={inspectItem?.file}
      />
    </div>
  );
}
