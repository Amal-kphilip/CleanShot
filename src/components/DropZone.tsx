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
    e.preventDefault(); e.stopPropagation();
    if (!disabled && !isProcessing) setIsDragOver(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragOver(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
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
        className={`relative group cursor-pointer rounded-2xl transition-all duration-200 overflow-hidden ${
          isDragOver
            ? 'border-2 border-dashed border-accent dark:border-accent-dark ring-4 ring-accent/10 dark:ring-accent/10 bg-accent/[0.04] dark:bg-accent/[0.06] scale-[1.005]'
            : 'border border-n-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.025] shadow-sm shadow-black/[0.04] hover:border-n-300 dark:hover:border-white/[0.14] hover:shadow-md hover:shadow-black/[0.06]'
        } p-8 sm:p-12 text-center flex flex-col items-center justify-center`}
      >
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

        {/* Upload Icon */}
        <div
          className={`mb-5 w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-200 ${
            isDragOver
              ? 'bg-accent dark:bg-accent-dark text-white scale-110'
              : 'bg-n-100 dark:bg-white/[0.06] text-n-400 dark:text-n-500 group-hover:bg-n-200 dark:group-hover:bg-white/[0.1] group-hover:text-n-600 dark:group-hover:text-n-300'
          }`}
        >
          <UploadCloud className="w-6 h-6" strokeWidth={1.75} />
        </div>

        {/* Headline */}
        <h3 className="text-[17px] sm:text-xl font-semibold text-n-900 dark:text-white mb-1.5 leading-snug">
          {isDragOver
            ? 'Drop to add photos'
            : <>Drop photos here, or{' '}
                <span className="text-accent dark:text-accent-dark">browse files</span>
              </>
          }
        </h3>
        <p className="text-[13px] text-n-500 dark:text-n-400 max-w-sm mb-6 leading-relaxed">
          Batch process 100+ images. Paste{' '}
          <kbd className="px-1.5 py-0.5 text-[11px] bg-n-100 dark:bg-white/[0.07] border border-n-200 dark:border-white/[0.08] rounded font-mono">Ctrl+V</kbd>
          {' '}or upload a folder.
        </p>

        {/* Action Buttons */}
        <div
          className="flex flex-row items-center gap-2.5 mb-6 w-full max-w-[280px] sm:max-w-none sm:w-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-accent dark:bg-accent-dark hover:opacity-90 active:scale-95 text-white text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all shadow-sm"
          >
            <ImagePlus className="w-4 h-4 shrink-0" />
            <span>Select Photos</span>
          </button>

          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-n-100 hover:bg-n-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] active:scale-95 text-n-700 dark:text-n-300 text-[13px] font-semibold border border-n-200 dark:border-white/[0.08] flex items-center justify-center gap-1.5 transition-all"
          >
            <FolderPlus className="w-4 h-4 shrink-0" />
            <span>Folder</span>
          </button>
        </div>

        {/* Format Chips — minimal */}
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {supportedFormats.map((fmt) => (
            <span
              key={fmt}
              className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-n-50 dark:bg-white/[0.04] text-n-400 dark:text-n-500 border border-n-200 dark:border-white/[0.06]"
            >
              {fmt}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
