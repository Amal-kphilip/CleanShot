'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { DropZone } from '@/components/DropZone';
import { FileItemState } from '@/components/FileList';
import { InspectorModal } from '@/components/InspectorModal';
import { SettingsModal } from '@/components/SettingsModal';
import { StripOptions, StripResult } from '@/lib/engine/types';
import {
  processBatchWithConcurrency,
  createThumbnail,
  inspectFileInWorker,
} from '@/lib/worker/workerRunner';
import { createZipArchive, triggerDownload } from '@/lib/zip/clientZip';
import { Loader2, Copy, Check, Bookmark, Download } from 'lucide-react';

const MAX_CLIENT_FILES = 150;
const MAX_CLIENT_FILE_BYTES = 50 * 1024 * 1024;
const MAX_CLIENT_BATCH_BYTES = 100 * 1024 * 1024;

export default function HomePage() {
  const [files, setFiles] = useState<FileItemState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isServerMode, setIsServerMode] = useState(false);
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

  const fetchServerFile = async (item: FileItemState): Promise<Blob> => {
    if (!item.serverJobId || !item.serverFileId)
      throw new Error('This server result is missing its download reference.');
    const response = await fetch(
      `/api/jobs/${encodeURIComponent(item.serverJobId)}/files/${encodeURIComponent(
        item.serverFileId
      )}`
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Download failed (${response.status}).`);
    }
    return response.blob();
  };

  const handleDownloadSingle = async (item: FileItemState) => {
    if (!item.result || item.status !== 'completed') return;
    try {
      if (item.serverJobId && item.serverFileId) {
        const blob = await fetchServerFile(item);
        triggerDownload(blob, item.result.cleanedFilename);
        return;
      }
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
  };

  const downloadReadyItems = async (readyFiles: FileItemState[]) => {
    if (!readyFiles.length) return;
    try {
      if (readyFiles.length === 1) {
        await handleDownloadSingle(readyFiles[0]);
        return;
      }
      const serverJobs = new Set(
        readyFiles.map((file) => file.serverJobId).filter(Boolean)
      );
      const allServerFiles = readyFiles.every((file) =>
        Boolean(file.serverJobId && file.serverFileId)
      );
      if (allServerFiles && serverJobs.size === 1) {
        const jobId = readyFiles[0].serverJobId!;
        const fileIds = readyFiles.map((file) => file.serverFileId!).join(',');
        const response = await fetch(
          `/api/jobs/${encodeURIComponent(
            jobId
          )}/zip?fileIds=${encodeURIComponent(fileIds)}`
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            payload.error || `ZIP download failed (${response.status}).`
          );
        }
        triggerDownload(
          await response.blob(),
          `cleanshot_cleaned_${Date.now()}.zip`
        );
        return;
      }
      const zipInputs = await Promise.all(
        readyFiles.map(async (file) => {
          const buffer = file.serverJobId
            ? new Uint8Array(await (await fetchServerFile(file)).arrayBuffer())
            : file.result!.cleanedBuffer;
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
        })
      );
      triggerDownload(
        createZipArchive(zipInputs, options.preserveFolderStructure),
        `cleanshot_cleaned_${Date.now()}.zip`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not create the download.';
      setBatchError(message);
    }
  };

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
        await downloadReadyItems(completed);
      }
      return;
    }

    if (isServerMode) {
      const serverOversized = queuedItems.find(
        (item) => item.file.size > 20 * 1024 * 1024
      );
      const serverBatchBytes = queuedItems.reduce(
        (total, item) => total + item.file.size,
        0
      );
      if (queuedItems.length > 40) {
        setBatchError(
          'Server-Side mode supports up to 40 files per batch. Use Client-Side mode for larger batches.'
        );
        return;
      }
      if (serverOversized) {
        setBatchError(
          `“${serverOversized.file.name}” exceeds the 20 MB per-file limit for Server-Side mode.`
        );
        return;
      }
      if (serverBatchBytes > 50 * 1024 * 1024) {
        setBatchError(
          'Server-Side mode is limited to 50 MB total per batch.'
        );
        return;
      }
    }

    setBatchError('');
    setIsProcessing(true);
    const queuedIds = new Set(queuedItems.map((item) => item.id));
    const newlyCompleted: FileItemState[] = [];

    try {
      if (!isServerMode) {
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
                      serverJobId: undefined,
                      serverFileId: undefined,
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
      } else {
        setFiles((prev) =>
          prev.map((file) =>
            queuedIds.has(file.id)
              ? { ...file, status: 'processing', progress: 0, error: undefined }
              : file
          )
        );
        const formData = new FormData();
        queuedItems.forEach((item) =>
          formData.append('files', item.file, item.file.name)
        );
        formData.append(
          'clientIds',
          JSON.stringify(queuedItems.map((item) => item.id))
        );
        formData.append('options', JSON.stringify(options));

        const response = await fetch('/api/jobs', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(
            data.error || `Server batch failed (${response.status}).`
          );
        if (typeof data.jobId !== 'string' || !Array.isArray(data.files)) {
          throw new Error('The server returned an invalid processing response.');
        }

        const serverFiles = new Map<
          string,
          {
            fileId?: string;
            filename: string;
            cleanedFilename: string;
            format: StripResult['format'];
            originalSize: number;
            cleanedSize: number;
            bytesSaved: number;
            removedFieldsCount: number;
            pixelIdentical: boolean;
            mimeType: string;
            error?: string;
            cleanedMetadata?: FileItemState['cleanedMetadata'];
          }
        >();
        for (const serverFile of data.files) {
          if (typeof serverFile.clientId === 'string')
            serverFiles.set(serverFile.clientId, serverFile);
        }

        setFiles((prev) =>
          prev.map((file) => {
            if (!queuedIds.has(file.id)) return file;
            const match = serverFiles.get(file.id);
            if (!match)
              return {
                ...file,
                status: 'error',
                progress: 0,
                error: 'The server did not return a result for this file.',
              };
            const result: StripResult = {
              filename: match.filename,
              cleanedFilename: match.cleanedFilename,
              format: match.format,
              originalSize: match.originalSize,
              cleanedSize: match.cleanedSize,
              bytesSaved: match.bytesSaved,
              percentSaved:
                match.originalSize > 0
                  ? Number(
                      ((match.bytesSaved / match.originalSize) * 100).toFixed(2)
                    )
                  : 0,
              removedFieldsCount: match.removedFieldsCount,
              removedSegments: [],
              pixelIdentical: match.pixelIdentical,
              cleanedBuffer: new Uint8Array(),
              mimeType: match.mimeType || 'application/octet-stream',
              error: match.error,
            };
            const updated: FileItemState = {
              ...file,
              status: match.error ? 'error' : 'completed',
              progress: match.error ? 0 : 100,
              error: match.error,
              result: match.error ? undefined : result,
              serverJobId: match.error ? undefined : data.jobId,
              serverFileId: match.error ? undefined : match.fileId,
              cleanedMetadata: match.error ? undefined : match.cleanedMetadata,
            };
            if (!match.error) newlyCompleted.push(updated);
            return updated;
          })
        );
      }

      if (newlyCompleted.length > 0) {
        await downloadReadyItems(newlyCompleted);
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
  }, [files, options, isServerMode, isProcessing]);

  const purgeServerJob = (jobId: string) => {
    void fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
      method: 'DELETE',
    }).catch(() => undefined);
  };

  const handleRemoveFile = (id: string) => {
    const item = files.find((file) => file.id === id);
    if (item) {
      revokeThumbnail(item);
      if (item.serverJobId) {
        const otherFilesFromJob = files.some(
          (file) => file.id !== id && file.serverJobId === item.serverJobId
        );
        if (!otherFilesFromJob) purgeServerJob(item.serverJobId);
        else if (item.serverFileId) {
          void fetch(
            `/api/jobs/${encodeURIComponent(
              item.serverJobId
            )}/files/${encodeURIComponent(item.serverFileId)}`,
            { method: 'DELETE' }
          ).catch(() => undefined);
        }
      }
    }
    setFiles((prev) => prev.filter((file) => file.id !== id));
    if (inspectItem?.id === id) setInspectItem(null);
  };

  const handleClearAll = () => {
    if (isProcessing) return;
    const jobIds = new Set(
      files
        .map((file) => file.serverJobId)
        .filter((id): id is string => Boolean(id))
    );
    jobIds.forEach(purgeServerJob);
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

      <main className="flex-1 w-full flex flex-col gap-8 sm:gap-10 py-4 sm:py-6">
        {/* Hero */}
        <section>
          <h1 className="text-[20px] sm:text-[26px] font-medium leading-[1.2] tracking-[-0.01em] text-foreground">
            This app removes hidden metadata directly in your browser, so your
            files stay on your device and you can practice good digital hygiene.
          </h1>
        </section>

        {batchError && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 p-3.5 rounded-[4px] border-2 border-red-500 bg-red-500/10 text-[13px] text-foreground"
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
        <div className="w-full flex flex-col gap-4">
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

          <div className="w-full flex justify-end items-center gap-3">
            <button
              type="button"
              disabled={files.length <= 0 || isProcessing}
              onClick={() => setIsClearConfirmOpen(true)}
              className="px-4 py-2.5 text-[13px] font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
            >
              Clear all
            </button>

            {!hasQueued && completedFiles.length > 0 ? (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => downloadReadyItems(completedFiles)}
                className="px-5 py-2.5 rounded-[4px] bg-foreground text-background hover:opacity-90 text-[13px] sm:text-[14px] font-semibold inline-flex items-center gap-2 transition-opacity disabled:opacity-40"
              >
                <Download className="w-4 h-4" />
                <span>
                  {completedFiles.length === 1
                    ? 'Download cleaned file'
                    : `Download ZIP (${completedFiles.length})`}
                </span>
              </button>
            ) : (
              <button
                type="button"
                disabled={files.length <= 0 || isProcessing}
                onClick={handleProcessAll}
                className="px-5 py-2.5 rounded-[4px] bg-foreground text-background hover:opacity-90 text-[13px] sm:text-[14px] font-semibold inline-flex items-center gap-2 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Remove metadata</span>
              </button>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-[3px] w-full bg-foreground" />

        {/* Share & Bookmark section */}
        <div className="w-full flex flex-col gap-5 text-[14px]">
          {/* Social sharing */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <span className="w-44 lg:w-52 font-medium text-[13px] sm:text-[14px]">
              Sharing is caring
            </span>
            <div className="grid grid-cols-4 gap-2">
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
                className="h-10 px-4 rounded-[4px] border-2 border-foreground bg-background hover:bg-black/5 dark:hover:bg-white/10 text-foreground text-[12px] font-medium inline-flex items-center justify-center gap-2 transition-colors"
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
                className="h-10 px-4 rounded-[4px] border-2 border-foreground bg-background hover:bg-black/5 dark:hover:bg-white/10 text-foreground text-[12px] font-medium inline-flex items-center justify-center gap-2 transition-colors"
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
                className="h-10 px-4 rounded-[4px] border-2 border-foreground bg-background hover:bg-black/5 dark:hover:bg-white/10 text-foreground text-[12px] font-medium inline-flex items-center justify-center gap-2 transition-colors"
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
                className="h-10 px-4 rounded-[4px] border-2 border-foreground bg-background hover:bg-black/5 dark:hover:bg-white/10 text-foreground text-[12px] font-medium inline-flex items-center justify-center gap-2 transition-colors"
              >
                <span>LinkedIn</span>
              </button>
            </div>
          </div>

          {/* Link to this tool */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <span className="w-44 lg:w-52 font-medium text-[13px] sm:text-[14px]">
              Link to this tool
            </span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="group sm:w-1/2 sm:max-w-sm flex items-stretch rounded-[4px] border-2 border-foreground overflow-hidden bg-background text-left cursor-pointer"
              aria-label="Copy link to this tool"
            >
              <span className="h-10 px-3 flex-1 inline-flex items-center text-[12px] font-medium text-foreground truncate">
                {shareUrl}
              </span>
              <span className="h-10 px-4 inline-flex items-center justify-center border-l-2 border-foreground bg-background group-hover:bg-black/5 dark:group-hover:bg-white/10 transition-colors text-foreground">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </span>
            </button>
          </div>

          {/* Bookmark */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            <span className="w-44 lg:w-52 font-medium text-[13px] sm:text-[14px]">
              Come back!
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setBookmarkNote(true)}
                className="h-10 px-4 rounded-[4px] border-2 border-foreground bg-background hover:bg-black/5 dark:hover:bg-white/10 text-foreground text-[12px] font-medium inline-flex items-center gap-2 transition-colors"
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
      <footer className="w-full py-8 sm:py-12 mt-auto">
        <div className="w-full flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end text-[12px] font-medium">
          <p className="text-text-sec">Built for everyday digital hygiene.</p>
          <div className="flex items-center gap-5 flex-wrap">
            <Link
              href="/how-it-works"
              className="underline underline-offset-4 hover:text-foreground text-text-sec"
            >
              How it works
            </Link>
            <Link
              href="/inspector"
              className="underline underline-offset-4 hover:text-foreground text-text-sec"
            >
              Inspector
            </Link>
            <Link
              href="/formats"
              className="underline underline-offset-4 hover:text-foreground text-text-sec"
            >
              Formats
            </Link>
            <Link
              href="/privacy"
              className="underline underline-offset-4 hover:text-foreground text-text-sec"
            >
              Privacy
            </Link>
            <Link
              href="/faq"
              className="underline underline-offset-4 hover:text-foreground text-text-sec"
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
        isServerMode={isServerMode}
        onToggleServerMode={setIsServerMode}
      />

      {isClearConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsClearConfirmOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-all-dialog-title"
            className="w-full max-w-md border-2 border-foreground rounded-[4px] bg-background p-6 flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1">
              <h3
                id="clear-all-dialog-title"
                className="text-[15px] font-semibold text-foreground leading-none"
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
                className="px-4 py-2 text-[12px] font-semibold rounded-[4px] border-2 border-foreground bg-background text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  handleClearAll();
                  setIsClearConfirmOpen(false);
                }}
                className="px-4 py-2 text-[12px] font-semibold rounded-[4px] border-2 border-foreground bg-red-600 hover:bg-red-700 text-white transition-colors"
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
