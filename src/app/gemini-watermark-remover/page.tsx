'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  Film,
  Image as ImageIcon,
  Info,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { ToolShell } from '@/components/tools/ToolShell';
import {
  removeGeminiWatermarkFromFile,
  type AdaptiveMode,
  type OutputFormat,
  type ProcessedWatermarkResult,
} from '@/lib/tools/geminiWatermark';
import type {
  ProcessedVideoResult,
  VideoDenoiseMode,
  VideoProgressUpdate,
} from '@/lib/tools/geminiVideoWatermark';
import { createZipArchive, triggerDownload } from '@/lib/zip/clientZip';

const MAX_IMAGE_SIZE = 50 * 1024 * 1024;
const MAX_VIDEO_SIZE = 500 * 1024 * 1024;

type MediaKind = 'image' | 'video';

type QueueItem = {
  id: string;
  file: File;
  kind: MediaKind;
  status: 'processing' | 'done' | 'error' | 'canceled';
  progress?: VideoProgressUpdate;
  imageResult?: ProcessedWatermarkResult;
  videoResult?: ProcessedVideoResult;
  error?: string;
};

function detectMediaKind(file: File): MediaKind | null {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (/\.(png|jpe?g|webp|bmp|gif|avif)$/i.test(file.name)) return 'image';
  if (/\.(mp4|webm|mov|m4v|mkv)$/i.test(file.name)) return 'video';
  return null;
}

function formatBytes(size: number): string {
  return size < 1024 * 1024
    ? `${(size / 1024).toFixed(1)} KB`
    : `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(seconds: number | undefined): string {
  if (!Number.isFinite(seconds) || seconds == null) return '—';
  const total = Math.max(0, seconds);
  const mins = Math.floor(total / 60);
  const secs = (total % 60).toFixed(1);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
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
  const [videoDenoiseMode, setVideoDenoiseMode] = useState<VideoDenoiseMode>('auto');
  const [preserveAudio, setPreserveAudio] = useState(true);
  const [split, setSplit] = useState(50);
  const [mediaTab, setMediaTab] = useState<'image' | 'video'>('image');
  const [videoView, setVideoView] = useState<'cleaned' | 'original'>('cleaned');
  const [isDragging, setIsDragging] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [zipBusy, setZipBusy] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUrlsRef = useRef(new Set<string>());
  const abortControllersRef = useRef(new Map<string, AbortController>());

  const trackUrl = (url: string) => {
    activeUrlsRef.current.add(url);
  };

  const releaseItemUrls = (item: QueueItem) => {
    const urls = [
      item.imageResult?.originalUrl,
      item.imageResult?.previewUrl,
      item.videoResult?.originalUrl,
      item.videoResult?.previewUrl,
    ];
    for (const url of urls) {
      if (url && activeUrlsRef.current.has(url)) {
        URL.revokeObjectURL(url);
        activeUrlsRef.current.delete(url);
      }
    }
  };

  useEffect(() => {
    const urls = activeUrlsRef.current;
    const controllers = abortControllersRef.current;
    return () => {
      controllers.forEach((ctrl) => ctrl.abort());
      controllers.clear();
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  const processImageItem = useCallback(
    async (id: string, file: File, mode: AdaptiveMode, format: OutputFormat) => {
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
            releaseItemUrls(item);
            return { ...item, status: 'done', imageResult: result, error: undefined };
          })
        );
      } catch (caught) {
        const message =
          caught instanceof Error ? caught.message : 'Failed to process this image.';
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: 'error', error: message } : item
          )
        );
      }
    },
    []
  );

  const processVideoItem = useCallback(
    async (
      id: string,
      file: File,
      denoiseMode: VideoDenoiseMode,
      keepAudio: boolean
    ) => {
      const controller = new AbortController();
      abortControllersRef.current.set(id, controller);

      try {
        const { removeGeminiWatermarkFromVideo } = await import(
          '@/lib/tools/geminiVideoWatermark'
        );
        const result = await removeGeminiWatermarkFromVideo(file, {
          denoiseMode,
          preserveAudio: keepAudio,
          signal: controller.signal,
          onProgress: (progress) => {
            setItems((prev) =>
              prev.map((item) =>
                item.id === id ? { ...item, progress } : item
              )
            );
          },
        });
        trackUrl(result.originalUrl);
        trackUrl(result.previewUrl);

        setItems((prev) =>
          prev.map((item) => {
            if (item.id !== id) return item;
            releaseItemUrls(item);
            return {
              ...item,
              status: 'done',
              videoResult: result,
              progress: undefined,
              error: undefined,
            };
          })
        );
      } catch (caught) {
        if (controller.signal.aborted) {
          setItems((prev) =>
            prev.map((item) =>
              item.id === id
                ? { ...item, status: 'canceled', progress: undefined, error: 'Processing canceled.' }
                : item
            )
          );
          return;
        }
        const message =
          caught instanceof Error ? caught.message : 'Failed to process this video.';
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, status: 'error', progress: undefined, error: message }
              : item
          )
        );
      } finally {
        abortControllersRef.current.delete(id);
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
        const kind = detectMediaKind(file);
        if (!kind) {
          rejected.push(`${file.name} is not a supported image or video file.`);
          continue;
        }
        const limit = kind === 'video' ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
        if (file.size > limit) {
          rejected.push(
            `${file.name} exceeds the ${kind === 'video' ? '500 MB' : '50 MB'} limit.`
          );
          continue;
        }
        valid.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          kind,
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
        if (entry.kind === 'video') {
          void processVideoItem(entry.id, entry.file, videoDenoiseMode, preserveAudio);
        } else {
          void processImageItem(entry.id, entry.file, adaptiveMode, outputFormat);
        }
      }
    },
    [adaptiveMode, outputFormat, preserveAudio, processImageItem, processVideoItem, videoDenoiseMode]
  );

  const cancelItem = (id: string) => {
    abortControllersRef.current.get(id)?.abort();
  };

  const reprocessAll = () => {
    if (items.length === 0) return;
    setGlobalError('');
    abortControllersRef.current.forEach((ctrl) => ctrl.abort());
    abortControllersRef.current.clear();

    const snapshot = items;
    setItems((prev) =>
      prev.map((item) => {
        releaseItemUrls(item);
        return {
          ...item,
          status: 'processing',
          imageResult: undefined,
          videoResult: undefined,
          progress: undefined,
          error: undefined,
        };
      })
    );

    for (const item of snapshot) {
      if (item.kind === 'video') {
        void processVideoItem(item.id, item.file, videoDenoiseMode, preserveAudio);
      } else {
        void processImageItem(item.id, item.file, adaptiveMode, outputFormat);
      }
    }
  };

  const removeItem = (id: string) => {
    abortControllersRef.current.get(id)?.abort();
    abortControllersRef.current.delete(id);
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) releaseItemUrls(target);
      const next = prev.filter((item) => item.id !== id);
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const clearAll = () => {
    abortControllersRef.current.forEach((ctrl) => ctrl.abort());
    abortControllersRef.current.clear();
    items.forEach((item) => releaseItemUrls(item));
    setItems([]);
    setActiveId(null);
    setGlobalError('');
  };

  const downloadAllZip = async () => {
    const ready = items.filter(
      (item) => item.status === 'done' && (item.imageResult || item.videoResult)
    );
    if (ready.length === 0) return;
    setZipBusy(true);
    try {
      const entries = await Promise.all(
        ready.map(async (item) => {
          const res = item.imageResult ?? item.videoResult!;
          return {
            name: res.outputName,
            data: new Uint8Array(await res.blob.arrayBuffer()),
          };
        })
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
  const readyItems = items.filter(
    (item) => item.status === 'done' && (item.imageResult || item.videoResult)
  );

  return (
    <ToolShell
      title="Gemini Watermark Remover"
      description="Remove visible Gemini & Veo AI watermarks from images and videos locally in your browser — no uploads, no sign-up."
    >
      {/* Segmented Pill Switcher matching geminiwatermarkremover.io */}
      <div className="flex justify-center">
        <div
          className="inline-flex flex-wrap justify-center rounded-[1.15rem] bg-slate-900/[0.05] dark:bg-white/[0.07] p-[3px]"
          aria-label="CleanShot tools"
        >
          <Link
            href="/"
            className="inline-flex h-10 min-w-[115px] items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-medium text-text-sec transition-all hover:text-foreground sm:min-w-[125px]"
          >
            <ShieldCheck className="h-4 w-4 text-text-ter" />
            <span>Metadata</span>
          </Link>
          <button
            type="button"
            onClick={() => setMediaTab('image')}
            aria-current={mediaTab === 'image' ? 'true' : undefined}
            className={`inline-flex h-10 min-w-[115px] items-center justify-center gap-2 rounded-xl px-4 text-[14px] transition-all sm:min-w-[130px] ${
              mediaTab === 'image'
                ? 'bg-glass-card font-semibold text-foreground shadow-sm'
                : 'font-medium text-text-sec hover:text-foreground'
            }`}
          >
            <ImageIcon className="h-4 w-4 text-[#145BF5]" />
            <span>Images</span>
          </button>
          <button
            type="button"
            onClick={() => setMediaTab('video')}
            aria-current={mediaTab === 'video' ? 'true' : undefined}
            className={`inline-flex h-10 min-w-[120px] items-center justify-center gap-2 rounded-xl px-4 text-[14px] transition-all sm:min-w-[140px] ${
              mediaTab === 'video'
                ? 'bg-glass-card font-semibold text-foreground shadow-sm'
                : 'font-medium text-text-sec hover:text-foreground'
            }`}
          >
            <Film className="h-4 w-4 text-[#145BF5]" />
            <span>Videos</span>
            <span className="rounded bg-blue-50 dark:bg-blue-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-[#145BF5] dark:text-[#60A5FA]">
              Beta
            </span>
          </button>
        </div>
      </div>

      {/* Signature Checkerboard Drop Zone */}
      <div className="mx-auto w-full max-w-3xl">
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
          className={`gwr-checkerboard group relative flex w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[20px] sm:rounded-[32px] border-[3px] p-6 sm:p-10 text-center transition-all duration-300 ease-out shadow-2xl shadow-blue-600/10 ${
            items.length > 0
              ? 'min-h-[180px] gap-4'
              : 'min-h-[280px] sm:min-h-[320px] lg:min-h-[380px] gap-5'
          } ${
            isDragging
              ? 'border-[#145BF5] ring-4 ring-[#145BF5]/20'
              : 'border-white dark:border-white/10'
          }`}
        >
          <span
            aria-hidden="true"
            className="absolute inset-0 bg-white/40 dark:bg-[#141720]/70 backdrop-blur-[2px] transition-opacity group-hover:bg-white/25 dark:group-hover:bg-[#141720]/55"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={mediaTab === 'video' ? 'video/*,image/*' : 'image/*,video/*'}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <span className="relative z-10 flex flex-col items-center gap-3 sm:gap-4 pt-1">
            <span
              className={`flex items-center gap-2 sm:gap-3 rounded-[12px] sm:rounded-[14px] bg-[#145BF5] font-semibold text-white transition-colors duration-200 group-hover:bg-[#0F4AD4] shadow-lg shadow-blue-600/20 ${
                items.length > 0
                  ? 'min-h-[44px] px-6 py-2.5 text-[14px]'
                  : 'min-h-[52px] px-8 py-3.5 text-[16px] sm:min-h-[64px] sm:px-[52px] sm:py-[18px] sm:text-[20px]'
              }`}
            >
              <Plus className="h-5 w-5 opacity-85 stroke-[2.5px]" />
              <span>
                {items.length > 0
                  ? 'Add more files'
                  : mediaTab === 'video'
                    ? 'Start with videos'
                    : 'Start with photos'}
              </span>
            </span>
            {items.length === 0 && (
              <>
                <span className="text-base sm:text-[20px] font-extrabold text-foreground tracking-tight">
                  {mediaTab === 'video'
                    ? 'or drag videos here'
                    : 'or drag images here'}
                </span>
                <span className="text-[12px] font-medium text-text-sec">
                  {mediaTab === 'video'
                    ? 'Supports MP4, WebM, MOV up to 500 MB · 100% browser-local'
                    : 'Supports PNG, JPEG, WebP up to 50 MB (or drop videos too) · 100% browser-local'}
                </span>
              </>
            )}
          </span>

          {/* Uploaded files list inside dropzone */}
          {items.length > 0 && (
            <ul
              className="relative z-10 w-full max-w-2xl flex flex-col gap-1.5 text-left"
              onClick={(e) => e.stopPropagation()}
            >
              {items.map((item) => {
                const selected = activeItem?.id === item.id;
                const readyOutput = item.imageResult ?? item.videoResult;
                return (
                  <li
                    key={item.id}
                    onClick={() => setActiveId(item.id)}
                    className={`flex items-center gap-3 py-2 px-3 rounded-xl border bg-glass-card/95 shadow-sm transition-colors cursor-pointer ${
                      selected
                        ? 'border-[#145BF5] ring-1 ring-[#145BF5]/30'
                        : 'border-[var(--border-subtle)] hover:border-[#145BF5]/40'
                    }`}
                  >
                    {item.kind === 'video' ? (
                      <Film className="shrink-0 w-4 h-4 text-[#145BF5]" />
                    ) : (
                      <ImageIcon className="shrink-0 w-4 h-4 text-[#145BF5]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] sm:text-[14px] font-medium text-foreground truncate">
                        {item.file.name}
                      </p>
                      <p className="text-[11px] text-text-sec truncate">
                        {item.status === 'processing'
                          ? item.kind === 'video' && item.progress
                            ? `${item.progress.message} (${Math.round(item.progress.progress * 100)}%)`
                            : 'Processing…'
                          : item.status === 'done'
                            ? `${formatBytes(readyOutput?.blob.size ?? item.file.size)} · Ready`
                            : item.error ?? 'Failed'}
                      </p>
                    </div>

                    {item.status === 'done' && readyOutput && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          triggerDownload(readyOutput.blob, readyOutput.outputName);
                        }}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#145BF5] dark:text-[#60A5FA] hover:underline inline-flex items-center gap-1"
                        title="Download cleaned file"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Save</span>
                      </button>
                    )}

                    {item.status === 'processing' && (
                      <LoaderCircle className="shrink-0 w-4 h-4 animate-spin text-[#145BF5]" />
                    )}
                    {item.status === 'done' && (
                      <CheckCircle2 className="shrink-0 w-4 h-4 text-[#145BF5]" />
                    )}
                    {(item.status === 'error' || item.status === 'canceled') && (
                      <AlertTriangle className="shrink-0 w-4 h-4 text-red-500" />
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                      aria-label={`Remove ${item.file.name}`}
                      className="p-1 rounded-lg text-text-sec hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Controls bar */}
      <section className="mx-auto w-full max-w-3xl flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-[var(--border-subtle)] bg-glass-card p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-text-ter">
              Image detection
            </span>
            <select
              value={adaptiveMode}
              onChange={(e) => setAdaptiveMode(e.target.value as AdaptiveMode)}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-[13px] font-medium text-foreground focus:outline-none"
            >
              <option value="auto">Auto (Recommended)</option>
              <option value="always">Always adaptive</option>
              <option value="off">Standard catalog only</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-text-ter">
              Image output
            </span>
            <select
              value={outputFormat}
              onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-[13px] font-medium text-foreground focus:outline-none"
            >
              <option value="auto">Match original (PNG fallback)</option>
              <option value="png">Lossless PNG</option>
              <option value="jpeg">JPEG (95%)</option>
              <option value="webp">WebP (95%)</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-text-ter">
              Video cleanup
            </span>
            <select
              value={videoDenoiseMode}
              onChange={(e) => setVideoDenoiseMode(e.target.value as VideoDenoiseMode)}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-[13px] font-medium text-foreground focus:outline-none"
            >
              <option value="auto">Auto (AI ONNX + Fallback)</option>
              <option value="ai">AI FDnCNN Denoise</option>
              <option value="fast">Fast Canvas Polish</option>
              <option value="none">Reverse Alpha Only</option>
            </select>
          </label>

          <label className="inline-flex items-center gap-2 pb-2 text-[13px] font-medium text-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={preserveAudio}
              onChange={(e) => setPreserveAudio(e.target.checked)}
              className="h-4 w-4 accent-[#145BF5] rounded"
            />
            Keep video audio
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {items.length > 0 && (
            <>
              <button
                type="button"
                onClick={reprocessAll}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-[12px] font-semibold text-foreground hover:border-[#145BF5]/40 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Reprocess
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-2 text-[12px] font-semibold text-text-sec hover:text-foreground hover:border-red-500/40 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear all
              </button>
            </>
          )}
        </div>
      </section>

      {globalError && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-black/[0.03] dark:bg-white/[0.04] p-4 text-[13px] text-foreground">
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
              {items.length === 1 ? 'file' : 'files'} loaded ·{' '}
              <span className="font-semibold text-foreground">{readyItems.length}</span>{' '}
              ready
            </div>

            {readyItems.length > 1 && (
              <button
                type="button"
                disabled={zipBusy}
                onClick={downloadAllZip}
                className="inline-flex items-center gap-2 rounded-lg bg-[#145BF5] hover:bg-[#0F4AD4] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:opacity-40"
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
                    className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      selected
                        ? 'border-[#145BF5] bg-[#145BF5] text-white shadow-sm'
                        : 'border-[var(--border-subtle)] bg-glass-card text-foreground hover:border-[#145BF5]/40'
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
                      {(item.status === 'error' || item.status === 'canceled') && (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      )}
                      {item.kind === 'video' ? (
                        <Film className="h-3.5 w-3.5 opacity-80" />
                      ) : (
                        <ImageIcon className="h-3.5 w-3.5 opacity-80" />
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

      {/* Active item workspace */}
      {activeItem && (
        <section className="space-y-6">
          {activeItem.status === 'processing' && (
            <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-glass-card p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 text-[14px] font-medium text-foreground">
                  <LoaderCircle className="h-5 w-5 animate-spin shrink-0 text-[#145BF5]" />
                  <span>
                    {activeItem.progress?.message ??
                      `Removing Gemini watermark from ${activeItem.file.name}…`}
                  </span>
                </div>
                {activeItem.kind === 'video' && (
                  <button
                    type="button"
                    onClick={() => cancelItem(activeItem.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-3 py-1.5 text-[12px] font-semibold text-foreground hover:border-red-500/40"
                  >
                    <Square className="h-3.5 w-3.5" /> Cancel
                  </button>
                )}
              </div>

              {activeItem.kind === 'video' && (
                <div className="space-y-1.5">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-elevated)]">
                    <div
                      className="h-full bg-[#145BF5] transition-all duration-150"
                      style={{
                        width: `${Math.round((activeItem.progress?.progress ?? 0) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-right text-[11px] font-semibold text-text-sec">
                    {Math.round((activeItem.progress?.progress ?? 0) * 100)}%
                  </p>
                </div>
              )}
            </div>
          )}

          {(activeItem.status === 'error' || activeItem.status === 'canceled') && (
            <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-[14px] text-foreground">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-primary)]" />
              <div>
                <p className="font-semibold">
                  {activeItem.status === 'canceled'
                    ? `Canceled ${activeItem.file.name}`
                    : `Could not process ${activeItem.file.name}`}
                </p>
                <p className="mt-1 text-[13px] text-text-sec">{activeItem.error}</p>
              </div>
            </div>
          )}

          {/* IMAGE RESULT */}
          {activeItem.status === 'done' && activeItem.imageResult && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-[12px] font-semibold text-text-sec">
                  <span>Before (Original)</span>
                  <span>Split: {split}%</span>
                  <span>After (Cleaned)</span>
                </div>

                <div className="relative w-full overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[#0f172a] shadow-sm select-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeItem.imageResult.previewUrl}
                    alt={`Cleaned ${activeItem.file.name}`}
                    className="block max-h-[560px] w-full object-contain"
                  />

                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeItem.imageResult.originalUrl}
                      alt={`Original ${activeItem.file.name}`}
                      className="block h-full w-full object-contain"
                    />
                  </div>

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

              <aside className="flex flex-col gap-4 rounded-xl border border-[var(--border-subtle)] bg-glass-card p-5 shadow-sm h-fit">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-foreground">
                      {activeItem.file.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-text-sec">
                      {activeItem.imageResult.width} × {activeItem.imageResult.height} px ·{' '}
                      {formatBytes(activeItem.imageResult.blob.size)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-xl border border-foreground px-2 py-0.5 text-[10px] font-semibold text-foreground">
                    {activeItem.imageResult.meta?.applied ? 'Cleaned' : 'Unchanged'}
                  </span>
                </div>

                <div className="h-[2px] w-full bg-foreground/15" />

                <div className="space-y-2.5 text-[12px]">
                  {activeItem.imageResult.meta?.applied ? (
                    <div className="flex items-start gap-2 text-foreground">
                      <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                      <span>Watermark removed via Reverse Alpha Blending.</span>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2 text-text-sec">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>{formatSkipReason(activeItem.imageResult.meta?.skipReason)}</span>
                    </div>
                  )}

                  <dl className="grid grid-cols-2 gap-y-1.5 pt-1 text-[12px]">
                    <dt className="text-text-sec">Watermark size</dt>
                    <dd className="text-right font-medium text-foreground">
                      {activeItem.imageResult.meta?.size
                        ? `${activeItem.imageResult.meta.size} × ${activeItem.imageResult.meta.size} px`
                        : '—'}
                    </dd>

                    <dt className="text-text-sec">Position</dt>
                    <dd className="text-right font-medium text-foreground">
                      {activeItem.imageResult.meta?.position
                        ? `${activeItem.imageResult.meta.position.x}, ${activeItem.imageResult.meta.position.y}`
                        : '—'}
                    </dd>

                    <dt className="text-text-sec">Passes</dt>
                    <dd className="text-right font-medium text-foreground">
                      {activeItem.imageResult.meta?.passCount ?? 0}
                    </dd>

                    <dt className="text-text-sec">Processing time</dt>
                    <dd className="text-right font-medium text-foreground">
                      {activeItem.imageResult.elapsedMs} ms
                    </dd>
                  </dl>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    triggerDownload(
                      activeItem.imageResult!.blob,
                      activeItem.imageResult!.outputName
                    )
                  }
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#145BF5] hover:bg-[#0F4AD4] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all active:scale-[0.98]"
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

          {/* VIDEO RESULT */}
          {activeItem.status === 'done' && activeItem.videoResult && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-glass-card overflow-hidden text-[12px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setVideoView('cleaned')}
                      className={`px-3 py-1.5 transition-colors ${
                        videoView === 'cleaned'
                          ? 'bg-[#145BF5] text-white'
                          : 'text-text-sec hover:text-foreground'
                      }`}
                    >
                      Cleaned MP4
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoView('original')}
                      className={`px-3 py-1.5 transition-colors ${
                        videoView === 'original'
                          ? 'bg-[#145BF5] text-white'
                          : 'text-text-sec hover:text-foreground'
                      }`}
                    >
                      Original
                    </button>
                  </div>
                  <span className="text-[12px] font-medium text-text-sec">
                    {videoView === 'cleaned' ? 'Watermark removed' : 'Original input'}
                  </span>
                </div>

                <div className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[#0f172a] shadow-sm">
                  <video
                    key={`${activeItem.id}-${videoView}`}
                    src={
                      videoView === 'cleaned'
                        ? activeItem.videoResult.previewUrl
                        : activeItem.videoResult.originalUrl
                    }
                    controls
                    playsInline
                    className="block max-h-[560px] w-full object-contain"
                  />
                </div>
              </div>

              <aside className="flex flex-col gap-4 rounded-xl border border-[var(--border-subtle)] bg-glass-card p-5 shadow-sm h-fit">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-foreground">
                      {activeItem.file.name}
                    </p>
                    <p className="mt-0.5 text-[12px] text-text-sec">
                      {activeItem.videoResult.exportResult.metadata.width} ×{' '}
                      {activeItem.videoResult.exportResult.metadata.height} px ·{' '}
                      {formatDuration(activeItem.videoResult.exportResult.metadata.duration)} ·{' '}
                      {formatBytes(activeItem.videoResult.blob.size)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-xl border border-foreground px-2 py-0.5 text-[10px] font-semibold text-foreground">
                    MP4
                  </span>
                </div>

                <div className="h-[2px] w-full bg-foreground/15" />

                <div className="space-y-2.5 text-[12px]">
                  <div className="flex items-start gap-2 text-foreground">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                    <span>
                      Processed {activeItem.videoResult.exportResult.processedFrames} frames locally via WebCodecs.
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-y-1.5 pt-1 text-[12px]">
                    <dt className="text-text-sec">Watermark</dt>
                    <dd className="text-right font-medium text-foreground">
                      {activeItem.videoResult.exportResult.detection?.position
                        ? `${activeItem.videoResult.exportResult.detection.position.width} × ${activeItem.videoResult.exportResult.detection.position.height} px`
                        : '—'}
                    </dd>

                    <dt className="text-text-sec">Cleanup backend</dt>
                    <dd className="text-right font-medium text-foreground truncate max-w-[140px]">
                      {activeItem.videoResult.exportResult.denoiseBackend}
                    </dd>

                    <dt className="text-text-sec">Audio track</dt>
                    <dd className="text-right font-medium text-foreground">
                      {activeItem.videoResult.exportResult.audioCopied ? 'Preserved' : 'None / Muted'}
                    </dd>

                    <dt className="text-text-sec">Processing time</dt>
                    <dd className="text-right font-medium text-foreground">
                      {(activeItem.videoResult.elapsedMs / 1000).toFixed(1)} s
                    </dd>
                  </dl>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    triggerDownload(
                      activeItem.videoResult!.blob,
                      activeItem.videoResult!.outputName
                    )
                  }
                  className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#145BF5] hover:bg-[#0F4AD4] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-all active:scale-[0.98]"
                >
                  <Download className="h-4 w-4" />
                  Download cleaned MP4
                </button>
              </aside>
            </div>
          )}
        </section>
      )}
    </ToolShell>
  );
}
