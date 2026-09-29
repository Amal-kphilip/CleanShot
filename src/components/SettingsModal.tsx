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
      className={`relative inline-flex w-10 h-6 rounded-full transition-colors duration-apple ease-apple shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        checked ? 'bg-accent' : 'bg-black/[0.12] dark:bg-white/[0.12]'
      }`}
    >
      <span
        className={`inline-block w-5 h-5 rounded-full bg-white shadow-sm mt-0.5 transition-transform duration-apple ease-apple ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
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
      <div className="relative w-full sm:max-w-lg liquid-glass sm:rounded-card rounded-t-card shadow-floating border border-border-subtle overflow-hidden flex flex-col max-h-[90dvh] animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-small liquid-glass text-foreground flex items-center justify-center shadow-xs">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-foreground">Settings</h3>
              <p className="text-[12px] text-text-ter">Stripping &amp; export options</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-text-ter hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Close settings"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-5 sm:px-6 py-5 space-y-6">

          {/* Color & Orientation */}
          <section className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-caps text-text-ter">
              Quality Preservation
            </h4>

            <label className="flex items-center justify-between gap-4 py-3 border-b border-border-subtle cursor-pointer select-none">
              <div className="flex items-start gap-3">
                <Palette className="w-4 h-4 text-text-ter mt-0.5 shrink-0" />
                <div>
                  <span className="text-[14px] font-medium text-foreground block">
                    Keep ICC Color Profile
                  </span>
                  <span className="text-[12px] text-text-ter block mt-0.5">
                    Preserve sRGB, P3, and Adobe RGB profiles. Recommended.
                  </span>
                </div>
              </div>
              <Toggle
                checked={options.keepIccProfile !== false}
                onChange={(v) => updateOpt('keepIccProfile', v)}
              />
            </label>

            <label className="flex items-center justify-between gap-4 py-3 cursor-pointer select-none">
              <div className="flex items-start gap-3">
                <RotateCw className="w-4 h-4 text-text-ter mt-0.5 shrink-0" />
                <div>
                  <span className="text-[14px] font-medium text-foreground block">
                    Preserve Image Orientation
                  </span>
                  <span className="text-[12px] text-text-ter block mt-0.5">
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
            <h4 className="text-[11px] font-semibold uppercase tracking-caps text-text-ter">
              Filename Suffix
            </h4>
            <input
              type="text"
              value={options.filenameSuffix ?? ''}
              onChange={(e) => updateOpt('filenameSuffix', e.target.value)}
              placeholder='e.g. "_clean" or leave blank'
              className="w-full px-3.5 py-2.5 text-[13px] rounded-small liquid-glass border border-border-subtle text-foreground placeholder:text-text-ter focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
            />
            <p className="text-[12px] text-text-ter">
              <code className="font-mono text-accent">photo.jpg</code>
              {' '}→{' '}
              <code className="font-mono text-accent">
                photo{options.filenameSuffix || ''}.jpg
              </code>
            </p>
          </section>

          {/* ZIP Structure */}
          <section className="space-y-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-caps text-text-ter">
              ZIP Archive
            </h4>
            <label className="flex items-center justify-between gap-4 py-2 cursor-pointer select-none">
              <div className="flex items-start gap-3">
                <FolderTree className="w-4 h-4 text-text-ter mt-0.5 shrink-0" />
                <div>
                  <span className="text-[14px] font-medium text-foreground block">
                    Preserve Folder Structure
                  </span>
                  <span className="text-[12px] text-text-ter block mt-0.5">
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
            <h4 className="text-[11px] font-semibold uppercase tracking-caps text-text-ter">
              Processing Mode
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onToggleServerMode(false)}
                className={`p-4 rounded-small border text-left transition-all apple-spring ${
                  !isServerMode
                    ? 'border-accent bg-accent-light shadow-xs'
                    : 'border-border-subtle liquid-glass hover:bg-glass-hover'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Cpu className="w-4 h-4 text-text-ter" />
                  {!isServerMode && <Check className="w-4 h-4 text-accent" />}
                </div>
                <div className="text-[13px] font-semibold text-foreground">Client-Side</div>
                <p className="text-[11px] text-text-ter mt-0.5">100% offline, never leaves device.</p>
              </button>

              <button
                type="button"
                onClick={() => onToggleServerMode(true)}
                className={`p-4 rounded-small border text-left transition-all apple-spring ${
                  isServerMode
                    ? 'border-accent bg-accent-light shadow-xs'
                    : 'border-border-subtle liquid-glass hover:bg-glass-hover'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Cpu className="w-4 h-4 text-text-ter" />
                  {isServerMode && <Check className="w-4 h-4 text-accent" />}
                </div>
                <div className="text-[13px] font-semibold text-foreground">Server-Side</div>
                <p className="text-[11px] text-text-ter mt-0.5">In-memory, 15-min auto purge.</p>
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-border-subtle flex justify-end" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-[13px] font-semibold rounded-pill bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 active:scale-[0.97] text-white shadow-accent-button apple-spring"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
