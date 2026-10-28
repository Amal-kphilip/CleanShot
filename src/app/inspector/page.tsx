'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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
  const [cleanedMime, setCleanedMime] = useState<string>('application/octet-stream');

  const handleFileSelect = async (files: File[]) => {
    if (files.length === 0) return;
    const selectedFile = files[0];
    setFile(selectedFile);
    setThumbnailUrl(createThumbnail(selectedFile));
    setIsInspecting(true);

    try {
      const buffer = new Uint8Array(await selectedFile.arrayBuffer());
      const meta = await inspectMetadata(buffer, selectedFile.name);
      setMetadata(meta);

      const stripRes = await stripImageMetadata(buffer, selectedFile.name);
      setCleanedBuffer(stripRes.error ? null : stripRes.cleanedBuffer);
      setCleanedMime(stripRes.mimeType || selectedFile.type || 'application/octet-stream');
    } catch (e) {
      console.error(e);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleDownloadCleaned = () => {
    if (!file || !cleanedBuffer) return;
    const blob = new Blob([new Uint8Array(cleanedBuffer)], { type: cleanedMime });
    triggerDownload(blob, `clean_${file.name}`);
  };

  return (
    <div className="flex flex-col flex-1 w-full">
      <Header />

      <main className="flex-1 w-full flex flex-col gap-8 sm:gap-10 py-4 sm:py-6">
        <section>
          <h1 className="text-[20px] sm:text-[26px] font-medium leading-[1.2] tracking-[-0.01em] text-foreground">
            Inspect hidden metadata embedded inside your files before sharing them.
          </h1>
        </section>

        {!file && (
          <DropZone
            onFilesSelected={handleFileSelect}
            isProcessing={isInspecting}
          />
        )}

        {file && metadata && (
          <div className="p-6 rounded-[4px] border-2 border-foreground bg-background space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
              <div className="flex items-center gap-3.5">
                {thumbnailUrl && (
                  <img
                    src={thumbnailUrl}
                    alt={file.name}
                    className="w-12 h-12 rounded-[4px] object-cover border border-foreground shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-foreground truncate max-w-xs sm:max-w-md">
                    {file.name}
                  </h3>
                  <p className="text-[12px] text-text-sec">
                    {(file.size / 1024 / 1024).toFixed(2)} MB ·{' '}
                    {metadata.format.toUpperCase()} · {metadata.fields.length}{' '}
                    fields detected
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2 rounded-[4px] bg-foreground text-background hover:opacity-90 text-[12px] font-semibold flex items-center gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Details</span>
                </button>

                {cleanedBuffer && (
                  <button
                    type="button"
                    onClick={handleDownloadCleaned}
                    className="px-4 py-2 rounded-[4px] border-2 border-foreground bg-background hover:bg-black/5 dark:hover:bg-white/10 text-foreground text-[12px] font-semibold flex items-center gap-1.5"
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
                  className="px-3 py-2 text-[12px] font-medium text-text-sec hover:text-foreground hover:underline underline-offset-4"
                >
                  Choose another file
                </button>
              </div>
            </div>

            {metadata.gps && (
              <div className="p-3.5 rounded-[4px] border-2 border-amber-500 bg-amber-500/10 flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-[12px]">
                  <span className="font-semibold text-foreground block mb-0.5">
                    Geographic Coordinates Exposed
                  </span>
                  <span className="text-text-sec">
                    <code className="font-mono">
                      {metadata.gps.latitude.toFixed(6)},{' '}
                      {metadata.gps.longitude.toFixed(6)}
                    </code>
                    {metadata.gps.altitude
                      ? ` · Altitude ${metadata.gps.altitude}m`
                      : ''}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-[4px] border-2 border-foreground">
                <span className="text-[11px] font-medium text-text-sec block mb-1">
                  Location Tags
                </span>
                <span className="text-[20px] font-semibold text-foreground tabular-nums">
                  {metadata.categories.location}
                </span>
              </div>

              <div className="p-3.5 rounded-[4px] border-2 border-foreground">
                <span className="text-[11px] font-medium text-text-sec block mb-1">
                  Device / Camera
                </span>
                <span className="text-[20px] font-semibold text-foreground tabular-nums">
                  {metadata.categories.camera}
                </span>
              </div>

              <div className="p-3.5 rounded-[4px] border-2 border-foreground">
                <span className="text-[11px] font-medium text-text-sec block mb-1">
                  Timestamps
                </span>
                <span className="text-[20px] font-semibold text-foreground tabular-nums">
                  {metadata.categories.datetime}
                </span>
              </div>

              <div className="p-3.5 rounded-[4px] border-2 border-foreground">
                <span className="text-[11px] font-medium text-text-sec block mb-1">
                  Author / Identity
                </span>
                <span className="text-[20px] font-semibold text-foreground tabular-nums">
                  {metadata.categories.author}
                </span>
              </div>
            </div>
          </div>
        )}

        <InspectorModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          metadata={metadata ?? undefined}
          filename={file?.name || ''}
          thumbnailUrl={thumbnailUrl}
          file={file ?? undefined}
        />
      </main>

      <footer className="w-full py-8 sm:py-12 mt-auto">
        <div className="w-full flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end text-[12px] font-medium">
          <p className="text-text-sec">Built for everyday digital hygiene.</p>
          <Link
            href="/"
            className="underline underline-offset-4 hover:text-foreground text-text-sec"
          >
            Back to metadata remover
          </Link>
        </div>
      </footer>
    </div>
  );
}
