'use client';

import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, FolderPlus, ImagePlus, Sparkles } from 'lucide-react';

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
          if (file) {
            imageFiles.push(file);
          }
        }
      }

      if (imageFiles.length > 0) {
        onFilesSelected(imageFiles);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [onFilesSelected, disabled, isProcessing]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isProcessing) {
      setIsDragOver(true);
    }
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

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      onFilesSelected(files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesSelected(files);
      e.target.value = '';
    }
  };

  const supportedFormats = [
    'JPEG / JPG',
    'PNG',
    'WebP',
    'HEIC / HEIF',
    'AVIF',
    'GIF',
    'TIFF / DNG',
    'SVG',
    'RAW',
  ];

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative group cursor-pointer rounded-2xl sm:rounded-3xl border-2 border-dashed transition-all duration-200 p-5 sm:p-10 text-center flex flex-col items-center justify-center overflow-hidden ${
          isDragOver
            ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/40 scale-[1.01] ring-4 ring-brand-500/20'
            : 'border-surface-300 dark:border-surface-700 bg-white/60 dark:bg-surface-900/60 hover:border-brand-400 dark:hover:border-brand-600 hover:bg-surface-50 dark:hover:bg-surface-800/40'
        }`}
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

        {/* Animated Icon Container */}
        <div className="relative mb-4">
          <div
            className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-300 ${
              isDragOver
                ? 'bg-brand-600 text-white scale-110 shadow-brand-500/30'
                : 'bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-brand-500/20 group-hover:scale-105'
            }`}
          >
            <UploadCloud className="w-7 h-7 sm:w-8 sm:h-8 animate-pulse-slow" />
          </div>
          <div className="absolute -bottom-1 -right-1 p-1 rounded-lg bg-emerald-500 text-white shadow-sm">
            <Sparkles className="w-3 h-3" />
          </div>
        </div>

        {/* Title and Subtitle - Mobile responsive no awkward break */}
        <h3 className="text-lg sm:text-2xl font-bold tracking-tight text-surface-900 dark:text-white mb-1.5 px-2">
          Drop photos here, or <span className="text-brand-600 dark:text-brand-400 underline decoration-2 underline-offset-4">browse files</span>
        </h3>
        <p className="text-xs sm:text-sm text-surface-500 dark:text-surface-400 max-w-md mb-5 px-2 leading-relaxed">
          Batch process 100+ images losslessly. Paste (<kbd className="px-1.5 py-0.5 text-[10px] bg-surface-200 dark:bg-surface-800 rounded font-mono">Ctrl+V</kbd>) or upload folders.
        </p>

        {/* Action Buttons */}
        <div
          className="flex flex-row items-center justify-center gap-2.5 sm:gap-3 mb-5 w-full max-w-xs sm:max-w-none"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-initial px-3.5 sm:px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-xs font-semibold shadow-md shadow-brand-500/20 flex items-center justify-center gap-1.5 transition-all"
          >
            <ImagePlus className="w-4 h-4 shrink-0" />
            <span>Select Photos</span>
          </button>

          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="flex-1 sm:flex-initial px-3.5 sm:px-4 py-2 rounded-xl bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 active:scale-95 text-surface-800 dark:text-surface-200 text-xs font-semibold border border-surface-200 dark:border-surface-700 flex items-center justify-center gap-1.5 transition-all"
          >
            <FolderPlus className="w-4 h-4 shrink-0" />
            <span>Folder</span>
          </button>
        </div>

        {/* Format Badges */}
        <div className="flex flex-wrap items-center justify-center gap-1 max-w-xl">
          {supportedFormats.map((fmt) => (
            <span
              key={fmt}
              className="text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800/80 text-surface-600 dark:text-surface-400 border border-surface-200/80 dark:border-surface-700/60"
            >
              {fmt}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
