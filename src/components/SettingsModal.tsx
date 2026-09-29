'use client';

import React from 'react';
import { X, Shield, Palette, RotateCw, FolderTree, Cpu, Check } from 'lucide-react';
import { StripOptions } from '@/lib/engine/types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: StripOptions;
  onChangeOptions: (opts: StripOptions) => void;
  isServerMode: boolean;
  onToggleServerMode: (val: boolean) => void;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-9 h-5 rounded-full transition-colors duration-200 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
        checked ? 'bg-accent dark:bg-accent-dark' : 'bg-n-200 dark:bg-n-700'
      }`}
    >
      <span
        className={`inline-block w-4 h-4 rounded-full bg-white shadow-sm mt-0.5 transition-transform duration-200 ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
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
    onChangeOptions({ ...options, [key]: val });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Bottom sheet on mobile, centered modal on sm+ */}
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-n-900 sm:rounded-2xl rounded-t-2xl shadow-2xl border-t sm:border border-n-200 dark:border-white/[0.08] overflow-hidden flex flex-col max-h-[90dvh] animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-n-100 dark:border-white/[0.07]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-n-100 dark:bg-white/[0.06] text-n-600 dark:text-n-300 flex items-center justify-center">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[14px] font-semibold text-n-900 dark:text-white">Settings</h3>
              <p className="text-[11px] text-n-400 dark:text-n-500">Stripping &amp; export options</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-n-400 hover:text-n-900 dark:hover:text-white hover:bg-n-100 dark:hover:bg-white/[0.07] transition-colors"
            aria-label="Close settings"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 sm:px-6 py-5 space-y-6">

          {/* Color & Orientation */}
          <section className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-n-400 dark:text-n-500">
              Quality Preservation
            </h4>

            <label className="flex items-center justify-between gap-4 py-3.5 border-b border-n-50 dark:border-white/[0.05] cursor-pointer">
              <div className="flex items-start gap-2.5">
                <Palette className="w-4 h-4 text-n-400 dark:text-n-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[13px] font-medium text-n-900 dark:text-white block">
                    Keep ICC Color Profile
                  </span>
                  <span className="text-[11px] text-n-400 dark:text-n-500 block mt-0.5">
                    Preserve sRGB, P3, and Adobe RGB profiles. Recommended.
                  </span>
                </div>
              </div>
              <Toggle
                checked={options.keepIccProfile !== false}
                onChange={(v) => updateOpt('keepIccProfile', v)}
              />
            </label>

            <label className="flex items-center justify-between gap-4 py-3.5 cursor-pointer">
              <div className="flex items-start gap-2.5">
                <RotateCw className="w-4 h-4 text-n-400 dark:text-n-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[13px] font-medium text-n-900 dark:text-white block">
                    Preserve Image Orientation
                  </span>
                  <span className="text-[11px] text-n-400 dark:text-n-500 block mt-0.5">
                    Ensures portrait photos display correctly after stripping.
                  </span>
                </div>
              </div>
              <Toggle
                checked={options.keepOrientation !== false}
                onChange={(v) => updateOpt('keepOrientation', v)}
              />
            </label>
          </section>

          {/* Filename Suffix */}
          <section className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-n-400 dark:text-n-500">
              Filename Suffix
            </h4>
            <input
              type="text"
              value={options.filenameSuffix ?? ''}
              onChange={(e) => updateOpt('filenameSuffix', e.target.value)}
              placeholder='e.g. "_clean" or leave blank'
              className="w-full px-3.5 py-2.5 text-[13px] rounded-xl bg-n-50 dark:bg-white/[0.04] border border-n-200 dark:border-white/[0.08] text-n-900 dark:text-white placeholder:text-n-300 dark:placeholder:text-n-600 focus:outline-none focus:ring-2 focus:ring-accent/40 dark:focus:ring-accent/30 transition"
            />
            <p className="text-[11px] text-n-400 dark:text-n-500">
              <code className="font-mono text-accent dark:text-accent-dark">photo.jpg</code>
              {' '}→{' '}
              <code className="font-mono text-accent dark:text-accent-dark">
                photo{options.filenameSuffix || ''}.jpg
              </code>
            </p>
          </section>

          {/* ZIP Structure */}
          <section className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-n-400 dark:text-n-500">
              ZIP Archive
            </h4>
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div className="flex items-start gap-2.5">
                <FolderTree className="w-4 h-4 text-n-400 dark:text-n-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-[13px] font-medium text-n-900 dark:text-white block">
                    Preserve Folder Structure
                  </span>
                  <span className="text-[11px] text-n-400 dark:text-n-500 block mt-0.5">
                    Keep subfolder tree when uploading nested folders.
                  </span>
                </div>
              </div>
              <Toggle
                checked={options.preserveFolderStructure === true}
                onChange={(v) => updateOpt('preserveFolderStructure', v)}
              />
            </label>
          </section>

          {/* Processing Mode */}
          <section className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-widest text-n-400 dark:text-n-500">
              Processing Mode
            </h4>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => onToggleServerMode(false)}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  !isServerMode
                    ? 'border-accent/40 dark:border-accent/30 bg-accent/[0.06] dark:bg-accent/[0.08]'
                    : 'border-n-200 dark:border-white/[0.08] hover:bg-n-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Cpu className="w-3.5 h-3.5 text-n-400 dark:text-n-500" />
                  {!isServerMode && <Check className="w-3.5 h-3.5 text-accent dark:text-accent-dark" />}
                </div>
                <div className="text-[12px] font-semibold text-n-900 dark:text-white">Client-Side</div>
                <p className="text-[11px] text-n-400 dark:text-n-500 mt-0.5">100% offline, never leaves device.</p>
              </button>

              <button
                type="button"
                onClick={() => onToggleServerMode(true)}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  isServerMode
                    ? 'border-accent/40 dark:border-accent/30 bg-accent/[0.06] dark:bg-accent/[0.08]'
                    : 'border-n-200 dark:border-white/[0.08] hover:bg-n-50 dark:hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <Cpu className="w-3.5 h-3.5 text-n-400 dark:text-n-500" />
                  {isServerMode && <Check className="w-3.5 h-3.5 text-accent dark:text-accent-dark" />}
                </div>
                <div className="text-[12px] font-semibold text-n-900 dark:text-white">Server-Side</div>
                <p className="text-[11px] text-n-400 dark:text-n-500 mt-0.5">In-memory, 15-min auto purge.</p>
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-n-100 dark:border-white/[0.07] flex justify-end" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-[13px] font-semibold rounded-xl bg-accent dark:bg-accent-dark hover:opacity-90 text-white shadow-sm transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
