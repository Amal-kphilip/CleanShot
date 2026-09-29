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
    <div className="min-h-dvh flex flex-col bg-[#FAFAFA] dark:bg-[#0C0C10] text-n-900 dark:text-n-100 selection:bg-accent/20 selection:text-accent">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-8">
        {/* Title */}
        <div className="text-center space-y-3">
          <h1 className="text-[30px] sm:text-[46px] font-semibold tracking-tight text-n-900 dark:text-white leading-[1.15]">
            Metadata <span className="text-accent dark:text-accent-dark">Inspector</span>
          </h1>
          <p className="text-[15px] sm:text-[17px] text-n-500 dark:text-n-400 max-w-lg mx-auto font-normal leading-relaxed">
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
          <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-white/[0.025] border border-n-200 dark:border-white/[0.08] shadow-sm space-y-6 animate-fade-up">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-n-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-3.5">
                {thumbnailUrl && (
                  <img
                    src={thumbnailUrl}
                    alt={file.name}
                    className="w-12 h-12 rounded-xl object-cover border border-n-200 dark:border-white/[0.08] shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <h3 className="text-[14px] font-semibold text-n-900 dark:text-white truncate max-w-xs sm:max-w-md">
                    {file.name}
                  </h3>
                  <p className="text-[11px] text-n-400 dark:text-n-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · {metadata.format.toUpperCase()} · {metadata.fields.length} fields detected
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-accent dark:bg-accent-dark hover:opacity-90 active:scale-95 text-white text-[12px] font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Details</span>
                </button>

                {cleanedBuffer && (
                  <button
                    type="button"
                    onClick={handleDownloadCleaned}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[12px] font-semibold flex items-center gap-1.5 transition-all shadow-sm"
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
                  className="px-3 py-2 rounded-xl text-[12px] font-medium text-n-500 dark:text-n-400 hover:text-n-900 dark:hover:text-white hover:bg-n-100 dark:hover:bg-white/[0.06] transition-colors"
                >
                  New Photo
                </button>
              </div>
            </div>

            {/* GPS Warning Strip */}
            {metadata.gps && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/50 flex items-start gap-2.5">
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3.5 rounded-xl bg-n-50 dark:bg-white/[0.02] border border-n-100 dark:border-white/[0.05]">
                <span className="text-[10px] font-semibold text-n-400 dark:text-n-500 uppercase tracking-wider block mb-1">
                  Location Tags
                </span>
                <span className="text-[19px] font-semibold text-n-900 dark:text-white">
                  {metadata.categories.location}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-n-50 dark:bg-white/[0.02] border border-n-100 dark:border-white/[0.05]">
                <span className="text-[10px] font-semibold text-n-400 dark:text-n-500 uppercase tracking-wider block mb-1">
                  Camera Info
                </span>
                <span className="text-[19px] font-semibold text-n-900 dark:text-white">
                  {metadata.categories.camera}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-n-50 dark:bg-white/[0.02] border border-n-100 dark:border-white/[0.05]">
                <span className="text-[10px] font-semibold text-n-400 dark:text-n-500 uppercase tracking-wider block mb-1">
                  Timestamps
                </span>
                <span className="text-[19px] font-semibold text-n-900 dark:text-white">
                  {metadata.categories.datetime}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-n-50 dark:bg-white/[0.02] border border-n-100 dark:border-white/[0.05]">
                <span className="text-[10px] font-semibold text-n-400 dark:text-n-500 uppercase tracking-wider block mb-1">
                  Author / Copyright
                </span>
                <span className="text-[19px] font-semibold text-n-900 dark:text-white">
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
    </div>
  );
}
