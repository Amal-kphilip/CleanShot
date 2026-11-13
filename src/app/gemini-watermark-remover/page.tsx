'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  Info,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { ToolShell } from '@/components/tools/ToolShell';
import {
  removeGeminiWatermarkFromFile,
  type AdaptiveMode,
  type OutputFormat,
  type ProcessedWatermarkResult,
} from '@/lib/tools/geminiWatermark';
import { createZipArchive, triggerDownload } from '@/lib/zip/clientZip';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

type QueueItem = {
  id: string;
  file: File;
  status: 'processing' | 'done' | 'error';
  result?: ProcessedWatermarkResult;
  error?: string;
};

function formatBytes(size: number): string {
  return size < 1024 * 1024
    ? `${(size / 1024).toFixed(1)} KB`
    : `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function formatSkipReason(reason: string | null | undefined): string {
  if (!reason) return 'No matching Gemini watermark signature was found.';
  return reason
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export default function GeminiWatermarkRemoverPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [adaptiveMode, setAdaptiveMode] = useState<AdaptiveMode>('auto');
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('auto');
  const [split, setSplit] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [zipBusy, setZipBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUrlsRef = useRef(new Set<string>());

  const trackUrl = (url: string) => {
    activeUrlsRef.current.add(url);
  };

  const releaseResultUrls = (result?: ProcessedWatermarkResult) => {
    if (!result) return;
    if (activeUrlsRef.current.has(result.originalUrl)) {
      URL.revokeObjectURL(result.originalUrl);
      activeUrlsRef.current.delete(result.originalUrl);
    }
    if (activeUrlsRef.current.has(result.previewUrl)) {
      URL.revokeObjectURL(result.previewUrl);
      activeUrlsRef.current.delete(result.previewUrl);
    }
  };

  useEffect(() => {
    const urls = activeUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const processSingleItem = useCallback(
    async (
      id: string,
      file: File,
      mode: AdaptiveMode,
      format: OutputFormat
    ) => {
      try {
        const result = await removeGeminiWatermarkFromFile(file, {
          adaptiveMode: mode,
          outputFormat: format,
        });
        trackUrl(result.originalUrl);
        trackUrl(result.previewUrl);

        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== id) return item;
            releaseResultUrls(item.result);
            return { ...item, status: 'done', result, error: undefined };
          })
        );
      } catch (caught) {
        const message =
          caught instanceof Error
            ? caught.message
            : 'Failed to process this image.';
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: 'error', error: message } : item
          )
        );
      }
    },
    []
  );

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      setGlobalError('');
      const incoming = Array.from(fileList);
      if (incoming.length === 0) return;

      const valid: QueueItem[] = [];
      const rejected: string[] = [];

      for (const file of incoming) {
        if (!file.type.startsWith('image/')) {
          rejected.push(`${file.name} is not a browser-supported image.`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          rejected.push(`${file.name} exceeds the 50 MB limit.`);
          continue;
        }
        valid.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          status: 'processing',
        });
      }

      if (rejected.length > 0) {
        setGlobalError(rejected.join(' '));
      }
      if (valid.length === 0) return;

      setItems((prev) => [...prev, ...valid]);
      setActiveId((prev) => prev ?? valid[0].id);

      for (const entry of valid) {
        void processSingleItem(entry.id, entry.file, adaptiveMode, outputFormat);
      }
    },
    [adaptiveMode, outputFormat, processSingleItem]
  );

  const reprocessAll = () => {
    if (items.length === 0) return;
    setGlobalError('');
    const snapshot = items;
    setItems((prev) =>
      prev.map((item) => {
        releaseResultUrls(item.result);
        return { ...item, status: 'processing', result: undefined, error: undefined };
      })
    );
    for (const item of snapshot) {
      void processSingleItem(item.id, item.file, adaptiveMode, outputFormat);
    }
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) releaseResultUrls(target.result);
      const next = prev.filter((item) => item.id !== id);
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const clearAll = () => {
    items.forEach((item) => releaseResultUrls(item.result));
    setItems([]);
    setActiveId(null);
    setGlobalError('');
  };

  const downloadAllZip = async () => {
    const ready = items.filter((item) => item.status === 'done' && item.result);
    if (ready.length === 0) return;
    setZipBusy(true);
    try {
      const entries = await Promise.all(
        ready.map(async (item) => ({
          name: item.result!.outputName,
          data: new Uint8Array(await item.result!.blob.arrayBuffer()),
        }))
      );
      const zipBlob = createZipArchive(entries, false);
      triggerDownload(zipBlob, 'gemini-watermark-removed.zip');
    } catch (caught) {
      setGlobalError(
        caught instanceof Error ? caught.message : 'Failed to create ZIP archive.'
      );
    } finally {
      setZipBusy(false);
    }
  };

  const activeItem = items.find((item) => item.id === activeId) ?? items[0] ?? null;
  const readyItems = items.filter((item) => item.status === 'done' && item.result);
  const removedCount = readyItems.filter(
    (item) => item.result?.meta?.applied
  ).length;

  return (
    <ToolShell
      title="Gemini Watermark Remover."
      description="Remove visible Gemini AI watermarks locally in your browser using Reverse Alpha Blending — no uploads, no AI hallucination."
    >
      {/* Controls bar */}
      <section className="flex flex-wrap items-end justify-between gap-4 rounded-[4px] border-2 border-foreground p-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-text-sec">
              Detection mode
            </span>
            <select
              value={adaptiveMode}
              onChange={(e) => setAdaptiveMode(e.target.value as AdaptiveMode)}
              className="rounded-[4px] border-2 border-foreground bg-background px-3 py-2 text-[13px] font-medium text-foreground focus:outline-none"
            >
              <option value="auto">Auto (Recommended)</option>
              <option value="always">Always adaptive</option>
              <option value="off">Standard catalog only</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-text-sec">
              Output format
            </span>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
              className="rounded-[4px] border-2 border-foreground bg-background px-3 py-2 text-[13px] font-medium text-foreground focus:outline-none"
            >
              <option value="auto">Match original (PNG fallback)</option>
              <option value="png">Lossless PNG</option>
              <option value="jpeg">JPEG (95%)</option>
              <option value="webp">WebP (95%)</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {items.length > 0 && (
            <>
              <button
                type="button"
                onClick={reprocessAll}
                className="inline-flex items-center gap-1.5 rounded-[4px] border-2 border-foreground px-3 py-2 text-[12px] font-semibold text-foreground hover:bg-black/5 dark:hover:bg-white/10"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reprocess
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 rounded-[4px] border-2 border-foreground px-3 py-2 text-[12px] font-semibold text-foreground hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear all
              </button>
            </>
          )}
        </div>
      </section>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-[4px] border-2 border-dashed p-8 sm:p-10 text-center transition-colors ${
          isDragging
            ? 'border-[var(--accent-primary)] bg-black/[0.04] dark:bg-white/[0.06]'
            : 'border-foreground hover:bg-black/[0.02] dark:hover:bg-white/[0.03]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-[4px] border-2 border-foreground text-foreground">
          <Upload className="h-5 w-5" />
        </span>
        <p className="text-[15px] font-semibold text-foreground">
          Drop Gemini images here or click to select
        </p>
        <p className="mt-1 text-[12px] text-text-sec">
          Supports PNG, JPEG, WebP up to 50 MB each · Processed 100% locally in your browser
        </p>
      </div>

      {globalError && (
        <div className="flex items-start gap-2.5 rounded-[4px] border-2 border-foreground bg-black/[0.03] dark:bg-white/[0.04] p-4 text-[13px] text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
          <span>{globalError}</span>
        </div>
      )}

      {/* Batch summary + file switcher */}
      {items.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[13px] font-medium text-text-sec">
              <span className="font-semibold text-foreground">{items.length}</span>{' '}
              {items.length === 1 ? 'image' : 'images'} loaded ·{' '}
              <span className="font-semibold text-foreground">{removedCount}</span>{' '}
              watermark{removedCount === 1 ? '' : 's'} removed
            </div>

            {readyItems.length > 1 && (
              <button
                type="button"
                disabled={zipBusy}
                onClick={downloadAllZip}
                className="inline-flex items-center gap-2 rounded-[4px] bg-foreground px-4 py-2 text-[13px] font-semibold text-background hover:opacity-90 disabled:opacity-40"
              >
                {zipBusy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="h-4 w-4" />
                )}
                Download all ({readyItems.length}) as ZIP
              </button>
            )}
          </div>

          {items.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {items.map((item) => {
                const selected = activeItem?.id === item.id;
                return (
                  <div
                    key={item.id}
                    className={`inline-flex items-center gap-2 rounded-[4px] border-2 px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      selected
                        ? 'border-foreground bg-foreground text-background'
                        : 'border-foreground bg-background text-foreground'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveId(item.id)}
                      className="inline-flex items-center gap-1.5 text-left"
                    >
                      {item.status === 'processing' && (
                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      )}
                      {item.status === 'done' && (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      {item.status === 'error' && (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      <span className="max-w-[160px] truncate">{item.file.name}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${item.file.name}`}
                      onClick={() => removeItem(item.id)}
                      className="opacity-70 hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Active image workspace */}
      {activeItem && (
        <section className="space-y-6">
          {activeItem.status === 'processing' && (
            <div className="flex items-center gap-3 rounded-[4px] border-2 border-foreground p-6 text-[14px] font-medium text-foreground">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              Removing Gemini watermark from {activeItem.file.name}…
            </div>
          )}

          {activeItem.status === 'error' && (
            <div className="flex items-start gap-3 rounded-[4px] border-2 border-foreground p-6 text-[14px] text-foreground">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-primary)]" />
              <div>
                <p className="font-semibold">Could not process {activeItem.file.name}</p>
                <p className="mt-1 text-[13px] text-text-sec">{activeItem.error}</p>
              </div>
            </div>
          )}

          {activeItem.status === 'done' && activeItem.result && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
              {/* Before / After interactive slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[12px] font-semibold text-text-sec">
                  <span>Before (Original)</span>
                  <span>Split: {split}%</span>
                  <span>After (Cleaned)</span>
                </div>

                <div className="relative w-full overflow-hidden rounded-[4px] border-2 border-foreground bg-[#111] select-none">
                  {/* Base layer: After (Cleaned) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeItem.result.previewUrl}
                    alt={`Cleaned ${activeItem.file.name}`}
                    className="block max-h-[560px] w-full object-contain"
                  />

                  {/* Clipped overlay: Before (Original) */}
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeItem.result.originalUrl}
                      alt={`Original ${activeItem.file.name}`}
                      className="block h-full w-full object-contain"
                    />
                  </div>

                  {/* Divider line */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
                    style={{ left: `${split}%` }}
                  />
                </div>

                <input
                  type="range"
                  min={0}
                  max={100}
                  value={split}
                  onChange={(e) => setSplit(Number(e.target.value))}
                  aria-label="Before and after comparison split"
                  className="w-full accent-foreground cursor-ew-resize"
                />
              </div>

              {/* Details & Download sidebar */}
              <aside className="flex flex-col gap-4 rounded-[4px] border-2 border-foreground p-5 h-fit">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-foreground">
                      {activeItem.file.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-text-sec">
                      {activeItem.result.width} × {activeItem.result.height} px ·{' '}
                      {formatBytes(activeItem.result.blob.size)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-[4px] border border-foreground px-2 py-0.5 text-[10px] font-semibold text-foreground">
                    {activeItem.result.meta?.applied ? 'Cleaned' : 'Unchanged'}
                  </span>
                </div>

                <div className="h-[2px] w-full bg-foreground/15" />

                <div className="space-y-2.5 text-[12px]">
                  {activeItem.result.meta?.applied ? (
                    <div className="flex items-start gap-2 text-foreground">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                      <span>
                        Watermark removed via Reverse Alpha Blending.
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-text-sec">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {formatSkipReason(activeItem.result.meta?.skipReason)}
                      </span>
                    </div>
                  )}

                  <dl className="grid grid-cols-2 gap-y-1.5 pt-1 text-[12px]">
                    <dt className="text-text-sec">Watermark size</dt>
                    <dd className="text-right font-medium text-foreground">
                      {activeItem.result.meta?.size
                        ? `${activeItem.result.meta.size} × ${activeItem.result.meta.size} px`
                        : '—'}
                    </dd>

                    <dt className="text-text-sec">Position</dt>
                    <dd className="text-right font-medium text-foreground">
                      {activeItem.result.meta?.position
                        ? `${activeItem.result.meta.position.x}, ${activeItem.result.meta.position.y}`
                        : '—'}
                    </dd>

                    <dt className="text-text-sec">Passes</dt>
                    <dd className="text-right font-medium text-foreground">
                      {activeItem.result.meta?.passCount ?? 0}
                    </dd>

                    <dt className="text-text-sec">Processing time</dt>
                    <dd className="text-right font-medium text-foreground">
                      {activeItem.result.elapsedMs} ms
                    </dd>
                  </dl>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    triggerDownload(
                      activeItem.result!.blob,
                      activeItem.result!.outputName
                    )
                  }
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-[4px] bg-foreground px-4 py-2.5 text-[13px] font-semibold text-background hover:opacity-90"
                >
                  <Download className="h-4 w-4" />
                  Download cleaned image
                </button>

                <p className="text-[11px] leading-relaxed text-text-sec">
                  Canvas export also strips embedded EXIF, GPS, and XMP metadata from the output file.
                </p>
              </aside>
            </div>
          )}
        </section>
      )}
    </ToolShell>
  );
}
