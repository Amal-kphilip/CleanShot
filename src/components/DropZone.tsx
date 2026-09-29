'use client';

import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, FolderPlus, ImagePlus } from 'lucide-react';

interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  isProcessing: boolean;
  disabled?: boolean;
}

export function DropZone({ onFilesSelected, isProcessing, disabled }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Global clipboard paste support (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled || isProcessing) return;
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) onFilesSelected(imageFiles);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onFilesSelected, disabled, isProcessing]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isProcessing) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled || isProcessing) return;
    if (e.dataTransfer.files?.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) {
      onFilesSelected(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const supportedFormats = ['JPEG', 'PNG', 'WebP', 'HEIC', 'AVIF', 'GIF', 'TIFF', 'SVG', 'RAW'];

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative group cursor-pointer rounded-dropzone transition-all duration-apple ease-apple overflow-hidden p-8 sm:p-14 text-center flex flex-col items-center justify-center ${
          isDragOver
            ? 'scale-[1.01] border-2 border-accent bg-accent-light ring-4 ring-accent-glow shadow-floating'
            : 'liquid-glass hover:shadow-floating hover:border-black/[0.12] dark:hover:border-white/[0.16]'
        }`}
        style={{
          boxShadow: isDragOver
            ? 'var(--shadow-floating), 0 0 30px var(--accent-glow)'
            : 'var(--shadow-glass)',
        }}
      >
        {/* Subtle top inner light highlight */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent pointer-events-none" />

        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,.heic,.heif,.avif,.cr2,.cr3,.nef,.arw,.dng,.orf,.rw2,.raf,.svg,.jxl"
          onChange={handleFileInputChange}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-ignore
          webkitdirectory=""
          directory=""
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Upload Icon inside Glass Rounded Square with Glow */}
        <div className="relative mb-5">
          <div
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center transition-all duration-apple ease-apple ${
              isDragOver
                ? 'bg-accent text-white scale-110 shadow-lg shadow-accent/30'
                : 'liquid-glass text-text-sec group-hover:text-foreground group-hover:scale-105'
            }`}
            style={{
              boxShadow: isDragOver
                ? '0 10px 25px -5px var(--accent-glow)'
                : '0 8px 20px -4px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
            }}
          >
            <UploadCloud className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={1.8} />
          </div>
        </div>

        {/* Headline */}
        <h3 className="text-[19px] sm:text-[22px] font-semibold tracking-tight text-foreground mb-2 leading-snug">
          {isDragOver ? (
            <span className="text-accent font-semibold">Drop to add photos</span>
          ) : (
            <>
              Drop photos here, or{' '}
              <span className="text-accent hover:underline decoration-1 underline-offset-4">
                browse files
              </span>
            </>
          )}
        </h3>

        {/* Subtitle with physical keycap */}
        <p className="text-[14px] text-text-sec max-w-sm mb-7 leading-relaxed">
          Batch process 100+ images. Paste <kbd className="keycap mx-1">Ctrl+V</kbd> or upload a folder.
        </p>

        {/* Action Buttons */}
        <div
          className="flex flex-row items-center gap-3 mb-7 w-full max-w-[280px] sm:max-w-none sm:w-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Primary Select Photos Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-initial px-5 py-2.5 rounded-pill bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 active:scale-[0.97] text-white text-[13px] font-semibold flex items-center justify-center gap-2 shadow-accent-button apple-spring relative overflow-hidden"
            style={{
              boxShadow: '0 4px 16px 0 rgba(79, 70, 229, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
            }}
          >
            <ImagePlus className="w-4 h-4 shrink-0" />
            <span>Select Photos</span>
          </button>

          {/* Secondary Folder Button */}
          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="flex-1 sm:flex-initial px-5 py-2.5 rounded-pill liquid-glass hover:bg-glass-hover active:scale-[0.97] text-foreground text-[13px] font-medium flex items-center justify-center gap-2 apple-spring"
          >
            <FolderPlus className="w-4 h-4 shrink-0 text-text-sec" />
            <span>Folder</span>
          </button>
        </div>

        {/* Format Tags (Quiet Metadata) */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-lg">
          {supportedFormats.map((fmt) => (
            <span
              key={fmt}
              className="text-[12px] font-medium px-2.5 py-0.5 rounded-pill bg-black/[0.03] dark:bg-white/[0.04] text-text-ter border border-border-subtle tracking-wide"
            >
              {fmt}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
