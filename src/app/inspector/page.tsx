'use client';

import React, { useState } from 'react';
import { Header } from '@/components/Header';
import { DropZone } from '@/components/DropZone';
import { InspectorModal } from '@/components/InspectorModal';
import { inspectMetadata } from '@/lib/engine/inspector';
import { stripImageMetadata } from '@/lib/engine/stripper';
import { createThumbnail } from '@/lib/worker/workerRunner';
import { triggerDownload } from '@/lib/zip/clientZip';
import { ParsedMetadata } from '@/lib/engine/types';
import { Eye, Download, MapPin } from 'lucide-react';

export default function InspectorPage() {
  const [file, setFile] = useState<File | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [metadata, setMetadata] = useState<ParsedMetadata | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [cleanedBuffer, setCleanedBuffer] = useState<Uint8Array | null>(null);

  const handleFileSelect = async (files: File[]) => {
    if (files.length === 0) return;
    const selectedFile = files[0];
    setFile(selectedFile);
    setThumbnailUrl(createThumbnail(selectedFile));
    setIsInspecting(true);

    try {
      const buffer = new Uint8Array(await selectedFile.arrayBuffer());
      const meta = await inspectMetadata(buffer);
      setMetadata(meta);

      const stripRes = await stripImageMetadata(buffer, selectedFile.name);
      setCleanedBuffer(stripRes.cleanedBuffer);
    } catch (e) {
      console.error(e);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleDownloadCleaned = () => {
    if (!file || !cleanedBuffer) return;
    const blob = new Blob([new Uint8Array(cleanedBuffer)], { type: file.type || 'image/jpeg' });
    triggerDownload(blob, `clean_${file.name}`);
  };

  return (
    <div className="flex flex-col min-h-dvh">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 space-y-12 sm:space-y-16">
        {/* Title */}
        <div className="text-center space-y-3">
          <h1 className="text-[36px] sm:text-[50px] font-semibold tracking-headline text-foreground leading-tight-title">
            Metadata{' '}
            <span className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-500 dark:from-indigo-400 dark:via-indigo-300 dark:to-violet-400 bg-clip-text text-transparent">
              Inspector
            </span>
          </h1>
          <p className="text-[15px] sm:text-[17px] text-text-sec max-w-lg mx-auto font-normal leading-relaxed">
            Drop any image to reveal hidden GPS coordinates, camera serials, creator identity, and capture parameters.
          </p>
        </div>

        {/* Upload Drop Zone */}
        {!file && (
          <DropZone
            onFilesSelected={handleFileSelect}
            isProcessing={isInspecting}
          />
        )}

        {/* Inspection Result Preview */}
        {file && metadata && (
          <div className="p-6 sm:p-7 rounded-card liquid-glass shadow-glass space-y-6 animate-fade-up">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
              <div className="flex items-center gap-3.5">
                {thumbnailUrl && (
                  <img
                    src={thumbnailUrl}
                    alt={file.name}
                    className="w-12 h-12 rounded-small object-cover border border-border-subtle shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold tracking-heading text-foreground truncate max-w-xs sm:max-w-md">
                    {file.name}
                  </h3>
                  <p className="text-[12px] text-text-ter">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · {metadata.format.toUpperCase()} · {metadata.fields.length} fields detected
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2 rounded-pill bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 active:scale-[0.97] text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-accent-button apple-spring"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Details</span>
                </button>

                {cleanedBuffer && (
                  <button
                    type="button"
                    onClick={handleDownloadCleaned}
                    className="px-4 py-2 rounded-pill bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97] text-white text-[12px] font-semibold flex items-center gap-1.5 shadow-sm apple-spring"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Cleaned</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setMetadata(null);
                    setCleanedBuffer(null);
                  }}
                  className="px-3 py-2 rounded-pill text-[12px] font-medium text-text-sec hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] apple-spring apple-press"
                >
                  New Photo
                </button>
              </div>
            </div>

            {/* GPS Warning Strip */}
            {metadata.gps && (
              <div className="p-3.5 rounded-small bg-amber-500/10 border border-amber-500/20 flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-[12px]">
                  <span className="font-semibold text-amber-900 dark:text-amber-300 block mb-0.5">
                    Geographic Coordinates Exposed
                  </span>
                  <span className="text-amber-700 dark:text-amber-400">
                    <code className="font-mono">{metadata.gps.latitude.toFixed(6)}, {metadata.gps.longitude.toFixed(6)}</code>
                    {metadata.gps.altitude ? ` · Altitude ${metadata.gps.altitude}m` : ''}
                  </span>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-small liquid-glass border border-border-subtle">
                <span className="text-[11px] font-semibold text-text-ter uppercase tracking-caps block mb-1">
                  Location Tags
                </span>
                <span className="text-[20px] font-semibold text-foreground tabular-nums">
                  {metadata.categories.location}
                </span>
              </div>

              <div className="p-3.5 rounded-small liquid-glass border border-border-subtle">
                <span className="text-[11px] font-semibold text-text-ter uppercase tracking-caps block mb-1">
                  Camera Info
                </span>
                <span className="text-[20px] font-semibold text-foreground tabular-nums">
                  {metadata.categories.camera}
                </span>
              </div>

              <div className="p-3.5 rounded-small liquid-glass border border-border-subtle">
                <span className="text-[11px] font-semibold text-text-ter uppercase tracking-caps block mb-1">
                  Timestamps
                </span>
                <span className="text-[20px] font-semibold text-foreground tabular-nums">
                  {metadata.categories.datetime}
                </span>
              </div>

              <div className="p-3.5 rounded-small liquid-glass border border-border-subtle">
                <span className="text-[11px] font-semibold text-text-ter uppercase tracking-caps block mb-1">
                  Author / Copyright
                </span>
                <span className="text-[20px] font-semibold text-foreground tabular-nums">
                  {metadata.categories.author}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Modal */}
        <InspectorModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          metadata={metadata ?? undefined}
          filename={file?.name || ''}
          thumbnailUrl={thumbnailUrl}
        />
      </main>

      {/* Minimal Footer */}
      <footer className="mt-auto border-t border-border-subtle py-8 px-4 text-center text-[12px] text-text-ter space-y-1">
        <p>CleanShot · Lossless Photo Privacy · 100% Client-Side</p>
        <p className="text-[11px]">Zero tracking · Zero server uploads · Pure byte manipulation</p>
      </footer>
    </div>
  );
}
