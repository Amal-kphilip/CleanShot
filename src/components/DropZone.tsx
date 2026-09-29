'use client';

import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, FolderPlus, ImagePlus, ShieldCheck, Sparkles } from 'lucide-react';

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
    'RAW (CR2, NEF, ARW)',
  ];

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative group cursor-pointer rounded-3xl border-2 border-dashed transition-all duration-200 p-8 sm:p-12 text-center flex flex-col items-center justify-center overflow-hidden ${
          isDragOver
            ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 scale-[1.01] ring-4 ring-brand-500/20'
            : 'border-surface-300 dark:border-surface-700 bg-white/50 dark:bg-surface-900/50 hover:border-brand-400 dark:hover:border-brand-600 hover:bg-surface-50/80 dark:hover:bg-surface-800/40'
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
        <div className="relative mb-5">
          <div
            className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-xl transition-all duration-300 ${
              isDragOver
                ? 'bg-brand-600 text-white scale-110 shadow-brand-500/30'
                : 'bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-brand-500/20 group-hover:scale-105'
            }`}
          >
            <UploadCloud className="w-10 h-10 animate-pulse-slow" />
          </div>
          <div className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-emerald-500 text-white shadow-md">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Title and Subtitle */}
        <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-surface-900 dark:text-white mb-2">
          Drop your photos here, or <span className="text-brand-600 dark:text-brand-400 underline decoration-2 underline-offset-4">browse files</span>
        </h3>
        <p className="text-sm text-surface-500 dark:text-surface-400 max-w-lg mb-6">
          Batch process 100+ images losslessly. Paste from clipboard (<kbd className="px-1.5 py-0.5 text-xs bg-surface-200 dark:bg-surface-800 rounded">Ctrl+V</kbd>) or upload whole folders.
        </p>

        {/* Action Buttons */}
        <div
          className="flex flex-wrap items-center justify-center gap-3 mb-6"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-md shadow-brand-500/20 flex items-center gap-2 transition-all hover:scale-[1.02]"
          >
            <ImagePlus className="w-4 h-4" />
            Select Photos
          </button>

          <button
            type="button"
            onClick={() => folderInputRef.current?.click()}
            className="px-4 py-2 rounded-xl bg-surface-100 hover:bg-surface-200 dark:bg-surface-800 dark:hover:bg-surface-700 text-surface-800 dark:text-surface-200 text-xs font-semibold border border-surface-200 dark:border-surface-700 flex items-center gap-2 transition-all hover:scale-[1.02]"
          >
            <FolderPlus className="w-4 h-4" />
            Upload Folder
          </button>
        </div>

        {/* Format Badges */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 max-w-2xl">
          {supportedFormats.map((fmt) => (
            <span
              key={fmt}
              className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800/80 text-surface-600 dark:text-surface-400 border border-surface-200 dark:border-surface-700/60"
            >
              {fmt}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
