'use client';

import React from 'react';
import { X, Check, Shield, Image, Palette, RotateCw, FolderTree, Cpu, Info } from 'lucide-react';
import { StripOptions } from '@/lib/engine/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: StripOptions;
  onChangeOptions: (opts: StripOptions) => void;
  isServerMode: boolean;
  onToggleServerMode: (val: boolean) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  options,
  onChangeOptions,
  isServerMode,
  onToggleServerMode,
}: SettingsModalProps) {
  if (!isOpen) return null;

  const updateOpt = <K extends keyof StripOptions>(key: K, val: StripOptions[K]) => {
    onChangeOptions({
      ...options,
      [key]: val,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-white dark:bg-surface-900 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-surface-900 dark:text-white">
                Stripping & Export Settings
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Configure lossless rules, selective filters, and output naming
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Color & Visual Quality Preservation */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
              Color & Orientation Fidelity
            </h4>

            {/* Keep ICC Profile */}
            <label className="flex items-start justify-between gap-4 p-3.5 rounded-xl border border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/40 cursor-pointer transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-brand-500" />
                  <span className="text-sm font-medium text-surface-900 dark:text-surface-100">
                    Keep ICC Color Profile (Recommended)
                  </span>
                </div>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Preserves embedded color profiles (sRGB, Display P3, Adobe RGB) to avoid washed-out or shifted colors.
                </p>
              </div>
              <input
                type="checkbox"
                checked={options.keepIccProfile !== false}
                onChange={(e) => updateOpt('keepIccProfile', e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-surface-300 dark:border-surface-700 dark:bg-surface-800"
              />
            </label>

            {/* Keep Orientation */}
            <label className="flex items-start justify-between gap-4 p-3.5 rounded-xl border border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/40 cursor-pointer transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <RotateCw className="w-4 h-4 text-brand-500" />
                  <span className="text-sm font-medium text-surface-900 dark:text-surface-100">
                    Preserve Image Orientation
                  </span>
                </div>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Ensures portrait and rotated photos display in correct orientation after removing EXIF tags.
                </p>
              </div>
              <input
                type="checkbox"
                checked={options.keepOrientation !== false}
                onChange={(e) => updateOpt('keepOrientation', e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-surface-300 dark:border-surface-700 dark:bg-surface-800"
              />
            </label>
          </div>

          {/* Filename & Output Suffix */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
              Filename Suffix
            </h4>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={options.filenameSuffix ?? ''}
                onChange={(e) => updateOpt('filenameSuffix', e.target.value)}
                placeholder='e.g. "_clean" or leave blank for original name'
                className="flex-1 px-3.5 py-2 text-sm rounded-lg bg-surface-50 dark:bg-surface-800 border border-surface-300 dark:border-surface-700 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <p className="text-[11px] text-surface-500 dark:text-surface-400">
              Example: <code className="text-brand-500">photo.jpg</code> &rarr;{' '}
              <code className="text-brand-500">
                photo{options.filenameSuffix || ''}.jpg
              </code>
            </p>
          </div>

          {/* ZIP Structure */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
              ZIP Archive Hierarchy
            </h4>
            <label className="flex items-start justify-between gap-4 p-3.5 rounded-xl border border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/40 cursor-pointer transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-brand-500" />
                  <span className="text-sm font-medium text-surface-900 dark:text-surface-100">
                    Preserve Folder Structure
                  </span>
                </div>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Retains directory subfolder tree when uploading nested folders.
                </p>
              </div>
              <input
                type="checkbox"
                checked={options.preserveFolderStructure === true}
                onChange={(e) => updateOpt('preserveFolderStructure', e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-surface-300 dark:border-surface-700 dark:bg-surface-800"
              />
            </label>
          </div>

          {/* Engine Processing Mode */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500">
              Processing Mode
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onToggleServerMode(false)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  !isServerMode
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 ring-2 ring-brand-500/20'
                    : 'border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-surface-900 dark:text-white">
                    Client-Side (WASM/Workers)
                  </span>
                  {!isServerMode && <Check className="w-3.5 h-3.5 text-brand-600" />}
                </div>
                <p className="text-[11px] text-surface-500 dark:text-surface-400">
                  100% offline, files never leave device.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onToggleServerMode(true)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isServerMode
                    ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-950/40 ring-2 ring-brand-500/20'
                    : 'border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-surface-900 dark:text-white">
                    Server-Side Fallback
                  </span>
                  {isServerMode && <Check className="w-3.5 h-3.5 text-brand-600" />}
                </div>
                <p className="text-[11px] text-surface-500 dark:text-surface-400">
                  In-memory sandbox with 15-min auto purge.
                </p>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-surface-50 dark:bg-surface-950 border-t border-surface-200 dark:border-surface-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium rounded-xl bg-brand-600 hover:bg-brand-700 text-white shadow-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
