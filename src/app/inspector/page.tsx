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
import { Eye, ShieldAlert, Download, CheckCircle2, MapPin, Camera, Calendar, Code, Sparkles, Layers } from 'lucide-react';

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
    <div className="min-h-screen flex flex-col bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 space-y-8">
        {/* Title */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 text-xs font-semibold border border-brand-200 dark:border-brand-800">
            <Eye className="w-3.5 h-3.5" />
            <span>Standalone Metadata Inspector</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-surface-900 dark:text-white">
            Inspect Image EXIF & Hidden Data
          </h1>
          <p className="text-sm text-surface-600 dark:text-surface-400 max-w-xl mx-auto">
            Drop any photo to analyze hidden GPS coordinates, camera serials, creator identity, and timestamps before sharing.
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
          <div className="p-6 rounded-3xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 shadow-xl space-y-6 animate-fade-in">
            {/* Top Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-200 dark:border-surface-800">
              <div className="flex items-center gap-3.5">
                {thumbnailUrl && (
                  <img
                    src={thumbnailUrl}
                    alt={file.name}
                    className="w-14 h-14 rounded-xl object-cover border border-surface-200 dark:border-surface-700"
                  />
                )}
                <div>
                  <h3 className="text-base font-bold text-surface-900 dark:text-white truncate max-w-md">
                    {file.name}
                  </h3>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB &bull; {metadata.format.toUpperCase()} &bull; {metadata.fields.length} Fields Found
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Full Inspector</span>
                </button>

                {cleanedBuffer && (
                  <button
                    type="button"
                    onClick={handleDownloadCleaned}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors"
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
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                >
                  New Photo
                </button>
              </div>
            </div>

            {/* GPS Warning */}
            {metadata.gps && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Geographic Coordinates Exposed
                  </h4>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                    Coordinates: <code className="font-mono">{metadata.gps.latitude.toFixed(6)}, {metadata.gps.longitude.toFixed(6)}</code>
                    {metadata.gps.altitude ? ` (Altitude ${metadata.gps.altitude}m)` : ''}.
                  </p>
                </div>
              </div>
            )}

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-800">
                <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider block">
                  Location Tags
                </span>
                <span className="text-lg font-bold text-surface-900 dark:text-white">
                  {metadata.categories.location}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-800">
                <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider block">
                  Camera Info
                </span>
                <span className="text-lg font-bold text-surface-900 dark:text-white">
                  {metadata.categories.camera}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-800">
                <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider block">
                  Timestamps
                </span>
                <span className="text-lg font-bold text-surface-900 dark:text-white">
                  {metadata.categories.datetime}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-50 dark:bg-surface-800/60 border border-surface-200 dark:border-surface-800">
                <span className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider block">
                  Author / Copyright
                </span>
                <span className="text-lg font-bold text-surface-900 dark:text-white">
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
