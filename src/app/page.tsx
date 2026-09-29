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
import { createZipArchive, triggerDownload } from '@/lib/zip/clientZip';
import { ShieldCheck, Zap, Lock, Cpu, Sparkles, CheckCircle2, ChevronRight, Layers } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const [files, setFiles] = useState<FileItemState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isServerMode, setIsServerMode] = useState(false);
  const [options, setOptions] = useState<StripOptions>({
    keepIccProfile: true,
    keepOrientation: true,
    stripAll: true,
    filenameSuffix: '',
    preserveFolderStructure: false,
  });

  // Modals state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inspectItem, setInspectItem] = useState<FileItemState | null>(null);

  // Add files to queue and auto-process
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

      // Start processing immediately
      setIsProcessing(true);

      if (!isServerMode) {
        // Client-side batch processing with concurrency = 4
        const tasks = initialItems.map((item) => ({
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
              prev.map((f) => (f.id === id ? { ...f, status: 'processing', progress: 30 } : f))
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
                      metadata: output.metadata,
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
          for (const item of initialItems) {
            formData.append('files', item.file);
          }
          formData.append('options', JSON.stringify(options));

          const res = await fetch('/api/jobs', {
            method: 'POST',
            body: formData,
          });

          if (!res.ok) throw new Error('Server batch failed');
          const data = await res.json();

          // Map server results back to items
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
                    percentSaved: Number(((serverMatch.bytesSaved / serverMatch.originalSize) * 100).toFixed(2)),
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
    },
    [options, isServerMode]
  );

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
    const blob = new Blob([new Uint8Array(item.result.cleanedBuffer)], { type: item.result.mimeType });
    triggerDownload(blob, item.result.cleanedFilename);
  };

  const handleDownloadZip = () => {
    const readyFiles = files.filter((f) => f.selected !== false && f.status === 'completed' && f.result);
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

  const handleProcessAll = () => {
    // Re-trigger queued or all files
    const uncleaned = files.map((f) => f.file);
    setFiles([]);
    handleFilesSelected(uncleaned);
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100 selection:bg-brand-500 selection:text-white pb-32">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950/70 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Lossless Zero-Recompression Engine</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-surface-900 dark:text-white leading-[1.1]">
            Remove photo metadata.{' '}
            <span className="bg-gradient-to-r from-brand-600 via-indigo-500 to-indigo-600 bg-clip-text text-transparent">
              Instantly. Losslessly.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-surface-600 dark:text-surface-400 max-w-2xl mx-auto">
            Strip GPS coordinates, device serial numbers, timestamps, and camera fingerprints from photos in bulk. Zero quality loss, 100% private in your browser.
          </p>

          {/* Feature Badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs font-medium text-surface-600 dark:text-surface-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Pixel-Identical Guarantee</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-brand-500" />
              <span>Zero Server Uploads</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              <span>Bulk 100+ Photos at Once</span>
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
          onRemoveFile={handleRemoveFile}
          onInspectFile={(item) => setInspectItem(item)}
          onDownloadFile={handleDownloadSingle}
          onToggleSelect={handleToggleSelect}
        />

        {/* Info Grid / Value Proposition */}
        {files.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10 border-t border-surface-200 dark:border-surface-800">
            <div className="p-6 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 flex items-center justify-center">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-surface-900 dark:text-white">
                Zero Recompression
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
                Unlike standard tools that decode and recompress images losing visual fidelity, CleanShot directly strips metadata segments (APPn, COM, tEXt) from the raw byte stream.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-surface-900 dark:text-white">
                100% Local & Private
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
                All byte-level stripping runs inside WebAssembly and Web Workers directly on your device. Your personal photos never touch a remote server.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-surface-900 dark:text-white">
                Metadata Inspector
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400 leading-relaxed">
                Examine full EXIF, IPTC, and XMP trees before stripping. Spot exposed GPS locations, lens serials, and author details before sharing online.
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
