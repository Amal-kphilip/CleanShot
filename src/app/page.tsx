'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
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
import { Lock, Cpu, Layers, CheckCircle2, Zap } from 'lucide-react';

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

  const handleDownload = () => {
    const readyFiles = files.filter(
      (f) => f.selected !== false && f.status === 'completed' && f.result
    );
    if (readyFiles.length === 0) return;

    // Single file download: download direct image file without zip wrapping
    if (readyFiles.length === 1) {
      handleDownloadSingle(readyFiles[0]);
      return;
    }

    // Multiple files: create and download ZIP archive
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
    <div className="flex flex-col min-h-dvh">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 space-y-12 sm:space-y-16">
        {/* Hero Section with Apple-grade Typography & Glass Pills */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          className="text-center space-y-4 max-w-2xl mx-auto px-2"
        >
          <h1 className="text-[36px] sm:text-[56px] font-semibold tracking-headline text-foreground leading-tight-title">
            Remove photo metadata.{' '}
            <span className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-500 dark:from-indigo-400 dark:via-indigo-300 dark:to-violet-400 bg-clip-text text-transparent">
              Losslessly.
            </span>
          </h1>

          <p className="text-[16px] sm:text-[18px] text-text-sec max-w-[560px] mx-auto leading-relaxed font-normal">
            Strip GPS coordinates, serial numbers, timestamps, and AI signatures with zero quality loss.
          </p>

          {/* Three Small Glass Trust Indicators */}
          <div className="flex items-center justify-center gap-2 sm:gap-2.5 flex-wrap pt-2">
            <span className="liquid-glass rounded-pill px-3 py-1.5 text-[12px] font-medium text-text-sec flex items-center gap-1.5 shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>Pixel-identical</span>
            </span>
            <span className="liquid-glass rounded-pill px-3 py-1.5 text-[12px] font-medium text-text-sec flex items-center gap-1.5 shadow-xs">
              <Lock className="w-3.5 h-3.5 text-accent shrink-0" />
              <span>Never uploaded</span>
            </span>
            <span className="liquid-glass rounded-pill px-3 py-1.5 text-[12px] font-medium text-text-sec flex items-center gap-1.5 shadow-xs">
              <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>100+ photos</span>
            </span>
          </div>
        </motion.div>

        {/* Upload Drop Zone (Centerpiece) */}
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

        {/* Feature Section Bento Grid (Shown when queue is empty) */}
        {files.length === 0 && (
          <div className="pt-8 sm:pt-12 pb-6">
            <div className="grid grid-cols-12 gap-4">
              {/* Card 1: Wide (7 cols) */}
              <div className="col-span-12 md:col-span-7 p-6 sm:p-8 rounded-card liquid-glass hover:shadow-floating hover:border-black/[0.14] dark:hover:border-white/[0.18] apple-spring hover:-translate-y-0.5 space-y-4 flex flex-col justify-between group">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-small liquid-glass flex items-center justify-center text-text-sec group-hover:text-foreground transition-colors shadow-xs">
                    <Cpu className="w-5 h-5" strokeWidth={1.8} />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-caps text-text-ter block">
                    Lossless Engine
                  </span>
                  <h3 className="text-[18px] sm:text-[20px] font-semibold tracking-heading text-foreground leading-snug">
                    Zero re-compression. Bit-exact raster.
                  </h3>
                  <p className="text-[14px] text-text-sec leading-relaxed">
                    Surgically removes APPn, COM, and tEXt chunks directly from the binary byte stream. DCT coefficients and uncompressed pixel rasters stay 100% untouched.
                  </p>
                </div>
              </div>

              {/* Card 2: Narrower (5 cols) */}
              <div className="col-span-12 md:col-span-5 p-6 sm:p-8 rounded-card liquid-glass hover:shadow-floating hover:border-black/[0.14] dark:hover:border-white/[0.18] apple-spring hover:-translate-y-0.5 space-y-4 flex flex-col justify-between group">
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-small liquid-glass flex items-center justify-center text-text-sec group-hover:text-foreground transition-colors shadow-xs">
                    <Lock className="w-5 h-5" strokeWidth={1.8} />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-caps text-text-ter block">
                    100% Private
                  </span>
                  <h3 className="text-[18px] sm:text-[20px] font-semibold tracking-heading text-foreground leading-snug">
                    In-browser only. Offline safe.
                  </h3>
                  <p className="text-[14px] text-text-sec leading-relaxed">
                    Everything executes locally on your CPU with concurrent Web Workers. Your personal photos never touch a remote server.
                  </p>
                </div>
              </div>

              {/* Card 3: Full Width (12 cols) with link */}
              <div className="col-span-12 p-6 sm:p-8 rounded-card liquid-glass hover:shadow-floating hover:border-black/[0.14] dark:hover:border-white/[0.18] apple-spring hover:-translate-y-0.5 space-y-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 group">
                <div className="space-y-3 max-w-xl">
                  <div className="w-10 h-10 rounded-small liquid-glass flex items-center justify-center text-text-sec group-hover:text-foreground transition-colors shadow-xs">
                    <Layers className="w-5 h-5" strokeWidth={1.8} />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-caps text-text-ter block">
                    Deep Inspector
                  </span>
                  <h3 className="text-[18px] sm:text-[20px] font-semibold tracking-heading text-foreground leading-snug">
                    Uncover what&apos;s hidden before you strip.
                  </h3>
                  <p className="text-[14px] text-text-sec leading-relaxed">
                    Examine GPS coordinates, camera serial numbers, author identity, and AI modification signatures in a dedicated inspector.
                  </p>
                </div>
                <div className="shrink-0">
                  <Link
                    href="/inspector"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-pill liquid-glass hover:bg-glass-hover text-foreground text-[13px] font-medium apple-spring apple-press"
                  >
                    <span>Open Inspector</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Minimal Apple-style Footer */}
      <footer className="mt-auto border-t border-border-subtle py-8 px-4 text-center text-[12px] text-text-ter space-y-1">
        <p>CleanShot · Lossless Photo Privacy · 100% Client-Side</p>
        <p className="text-[11px]">Zero tracking · Zero server uploads · Pure byte manipulation</p>
      </footer>

      {/* Sticky Action Bar */}
      <ActionBar
        files={files}
        isProcessing={isProcessing}
        onDownload={handleDownload}
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
