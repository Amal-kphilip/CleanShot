'use client';

import React, { useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { DropZone } from '@/components/DropZone';
import { FileList, FileItemState } from '@/components/FileList';
import { SummaryCard } from '@/components/SummaryCard';
import { ActionBar } from '@/components/ActionBar';
import { InspectorModal } from '@/components/InspectorModal';
import { SettingsModal } from '@/components/SettingsModal';
import { StripOptions } from '@/lib/engine/types';
import { processBatchWithConcurrency, createThumbnail } from '@/lib/worker/workerRunner';
import { inspectMetadata } from '@/lib/engine/inspector';
import { createZipArchive, triggerDownload } from '@/lib/zip/clientZip';
import { Lock, Cpu, Layers } from 'lucide-react';


export default function HomePage() {
  const [files, setFiles] = useState<FileItemState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isServerMode, setIsServerMode] = useState(false);
  const [options, setOptions] = useState<StripOptions>({
    keepIccProfile: true,
    keepOrientation: true,
    stripAll: true,
    filenameSuffix: '_clean',
    preserveFolderStructure: false,
  });

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inspectItem, setInspectItem] = useState<FileItemState | null>(null);

  // Add files to queue and inspect metadata without immediately stripping
  const handleFilesSelected = useCallback(
    async (newFiles: File[]) => {
      const initialItems: FileItemState[] = newFiles.map((file) => ({
        id: crypto.randomUUID(),
        file,
        relativePath: (file as any).webkitRelativePath || file.name,
        thumbnailUrl: createThumbnail(file),
        status: 'queued',
        progress: 0,
        selected: true,
      }));

      setFiles((prev) => [...prev, ...initialItems]);

      // Inspect metadata in background for preview
      for (const item of initialItems) {
        try {
          const buffer = new Uint8Array(await item.file.arrayBuffer());
          const meta = await inspectMetadata(buffer);
          setFiles((prev) =>
            prev.map((f) => (f.id === item.id ? { ...f, metadata: meta } : f))
          );
        } catch (e) {}
      }
    },
    []
  );

  // Explicit user action to strip metadata
  const handleProcessAll = useCallback(async () => {
    const queuedItems = files.filter(
      (f) => f.selected !== false && (f.status === 'queued' || f.status === 'error')
    );
    if (queuedItems.length === 0) return;

    setIsProcessing(true);

    if (!isServerMode) {
      // Client-side batch processing with Web Workers
      const tasks = queuedItems.map((item) => ({
        id: item.id,
        file: item.file,
        relativePath: item.relativePath,
        options,
      }));

      await processBatchWithConcurrency(
        tasks,
        4,
        (id) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === id ? { ...f, status: 'processing', progress: 40 } : f))
          );
        },
        (output) => {
          setFiles((prev) =>
            prev.map((f) =>
              f.id === output.id
                ? {
                    ...f,
                    status: output.result.error ? 'error' : 'completed',
                    progress: 100,
                    result: output.result,
                    metadata: output.metadata || f.metadata,
                    error: output.result.error,
                  }
                : f
            )
          );
        },
        (id, err) => {
          setFiles((prev) =>
            prev.map((f) => (f.id === id ? { ...f, status: 'error', error: err } : f))
          );
        }
      );
    } else {
      // Server-Side Fallback via /api/jobs
      try {
        const formData = new FormData();
        for (const item of queuedItems) {
          formData.append('files', item.file);
        }
        formData.append('options', JSON.stringify(options));

        const res = await fetch('/api/jobs', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) throw new Error('Server batch failed');
        const data = await res.json();

        setFiles((prev) =>
          prev.map((f) => {
            const serverMatch = data.files?.find(
              (sf: any) => sf.filename === f.file.name
            );
            if (serverMatch) {
              return {
                ...f,
                status: 'completed',
                progress: 100,
                result: {
                  filename: f.file.name,
                  cleanedFilename: serverMatch.cleanedFilename,
                  format: serverMatch.format,
                  originalSize: serverMatch.originalSize,
                  cleanedSize: serverMatch.cleanedSize,
                  bytesSaved: serverMatch.bytesSaved,
                  percentSaved: Number(
                    ((serverMatch.bytesSaved / serverMatch.originalSize) * 100).toFixed(2)
                  ),
                  removedFieldsCount: serverMatch.removedFieldsCount,
                  removedSegments: [],
                  pixelIdentical: serverMatch.pixelIdentical,
                  cleanedBuffer: new Uint8Array(),
                  mimeType: 'image/jpeg',
                },
              };
            }
            return f;
          })
        );
      } catch (e: any) {
        setFiles((prev) =>
          prev.map((f) =>
            f.status === 'queued' ? { ...f, status: 'error', error: e.message } : f
          )
        );
      }
    }

    setIsProcessing(false);
  }, [files, options, isServerMode]);

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleToggleSelect = (id: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, selected: f.selected === false } : f))
    );
  };

  const handleDownloadSingle = (item: FileItemState) => {
    if (!item.result) return;
    const blob = new Blob([new Uint8Array(item.result.cleanedBuffer)], {
      type: item.result.mimeType,
    });
    triggerDownload(blob, item.result.cleanedFilename);
  };

  const handleDownloadZip = () => {
    const readyFiles = files.filter(
      (f) => f.selected !== false && f.status === 'completed' && f.result
    );
    if (readyFiles.length === 0) return;

    const zipInputs = readyFiles.map((f) => ({
      name: f.result!.cleanedFilename,
      data: f.result!.cleanedBuffer,
      path: options.preserveFolderStructure ? f.relativePath : undefined,
    }));

    const zipBlob = createZipArchive(zipInputs, options.preserveFolderStructure);
    triggerDownload(zipBlob, `cleanshot_cleaned_${Date.now()}.zip`);
  };

  const handleClearAll = () => {
    setFiles([]);
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[#FAFAFA] dark:bg-[#0C0C10] text-n-900 dark:text-n-100 selection:bg-accent/20 selection:text-accent pb-36 sm:pb-32">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-14 space-y-6 sm:space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-2xl mx-auto px-2">
          <h1 className="text-[32px] sm:text-[52px] font-semibold tracking-tight text-n-900 dark:text-white leading-[1.12]">
            Remove photo metadata.{' '}
            <span className="text-accent dark:text-accent-dark">Losslessly.</span>
          </h1>

          <p className="text-[15px] sm:text-[17px] text-n-500 dark:text-n-400 max-w-lg mx-auto leading-relaxed font-normal">
            Strip GPS coordinates, serial numbers, timestamps, and AI signatures with zero quality loss.
          </p>

          {/* Single trust line */}
          <p className="text-[13px] text-n-400 dark:text-n-500 flex items-center justify-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Pixel-identical
            </span>
            <span className="text-n-200 dark:text-n-700">·</span>
            <span>Never uploaded</span>
            <span className="text-n-200 dark:text-n-700">·</span>
            <span>100+ photos</span>
          </p>
        </div>

        {/* Upload Drop Zone */}
        <DropZone
          onFilesSelected={handleFilesSelected}
          isProcessing={isProcessing}
        />

        {/* Summary Card */}
        <SummaryCard files={files} />

        {/* File Queue & Processing List */}
        <FileList
          files={files}
          isProcessing={isProcessing}
          onRemoveFile={handleRemoveFile}
          onInspectFile={(item) => setInspectItem(item)}
          onDownloadFile={handleDownloadSingle}
          onToggleSelect={handleToggleSelect}
          onProcessAll={handleProcessAll}
        />

        {/* Value Proposition — shown only when queue is empty */}
        {files.length === 0 && (
          <div className="pt-10 sm:pt-14 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-n-100 dark:divide-white/[0.06]">
              <div className="px-0 sm:px-8 py-6 sm:py-0 first:pt-0 last:pb-0 sm:first:pl-0 sm:last:pr-0 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Cpu className="w-4 h-4 text-n-400 dark:text-n-500" strokeWidth={1.5} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-n-400 dark:text-n-500">Lossless Engine</span>
                </div>
                <h3 className="text-[15px] font-semibold text-n-900 dark:text-white leading-snug">
                  Zero re-compression
                </h3>
                <p className="text-[13px] text-n-500 dark:text-n-400 leading-relaxed">
                  Strips APPn, COM, and tEXt chunks directly from the byte stream. DCT coefficients untouched.
                </p>
              </div>

              <div className="px-0 sm:px-8 py-6 sm:py-0 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Lock className="w-4 h-4 text-n-400 dark:text-n-500" strokeWidth={1.5} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-n-400 dark:text-n-500">100% Private</span>
                </div>
                <h3 className="text-[15px] font-semibold text-n-900 dark:text-white leading-snug">
                  In-browser only
                </h3>
                <p className="text-[13px] text-n-500 dark:text-n-400 leading-relaxed">
                  Everything runs locally. Your photos never touch a server. No account, no tracking.
                </p>
              </div>

              <div className="px-0 sm:px-8 py-6 sm:py-0 space-y-2">
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-n-400 dark:text-n-500" strokeWidth={1.5} />
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-n-400 dark:text-n-500">Inspector</span>
                </div>
                <h3 className="text-[15px] font-semibold text-n-900 dark:text-white leading-snug">
                  See what&apos;s hidden
                </h3>
                <p className="text-[13px] text-n-500 dark:text-n-400 leading-relaxed">
                  Inspect GPS, camera serials, author details, and AI signatures before you strip.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Sticky Action Bar */}
      <ActionBar
        files={files}
        isProcessing={isProcessing}
        onDownloadZip={handleDownloadZip}
        onClearAll={handleClearAll}
        onProcessAll={handleProcessAll}
      />

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        options={options}
        onChangeOptions={setOptions}
        isServerMode={isServerMode}
        onToggleServerMode={setIsServerMode}
      />

      <InspectorModal
        isOpen={Boolean(inspectItem)}
        onClose={() => setInspectItem(null)}
        metadata={inspectItem?.metadata}
        filename={inspectItem?.file.name || ''}
        thumbnailUrl={inspectItem?.thumbnailUrl}
      />
    </div>
  );
}
