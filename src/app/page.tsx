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
import { Lock, Zap, Sparkles, CheckCircle2, Cpu, Layers } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100 selection:bg-brand-500 selection:text-white pb-36 sm:pb-32">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-3.5 sm:px-6 lg:px-8 pt-6 sm:pt-10 space-y-6 sm:space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-3 max-w-2xl mx-auto px-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/70 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Lossless Zero-Recompression</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-surface-900 dark:text-white leading-[1.15]">
            Remove photo metadata.{' '}
            <span className="bg-gradient-to-r from-brand-600 via-indigo-500 to-indigo-600 bg-clip-text text-transparent">
              Instantly. Losslessly.
            </span>
          </h1>

          <p className="text-xs sm:text-base text-surface-600 dark:text-surface-400 max-w-xl mx-auto leading-relaxed">
            Strip GPS coordinates, serial numbers, timestamps, and device fingerprints in bulk with zero quality loss.
          </p>

          {/* Feature Badges */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 pt-1 text-[11px] sm:text-xs font-medium text-surface-600 dark:text-surface-400">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              <span>Pixel-Identical</span>
            </div>
            <div className="flex items-center gap-1">
              <Lock className="w-3.5 h-3.5 text-brand-500" />
              <span>Zero Uploads</span>
            </div>
            <div className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>100+ Photos</span>
            </div>
          </div>
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

        {/* Info Grid / Value Proposition */}
        {files.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-surface-200 dark:border-surface-800">
            <div className="p-5 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <Cpu className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-surface-900 dark:text-white">
                Zero Recompression
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
                CleanShot removes APPn, COM, and tEXt chunks directly from the byte stream without touching DCT coefficients.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-surface-900 dark:text-white">
                100% In-Browser
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
                All stripping runs locally in your browser with Web Workers. Your personal photos never leave your device.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 space-y-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-surface-900 dark:text-white">
                EXIF Inspector
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
                Inspect GPS coordinates, camera serials, and author details before stripping with our interactive inspector.
              </p>
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
