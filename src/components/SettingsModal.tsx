'use client';

import React, { useRef } from 'react';
import { X, Check } from 'lucide-react';
import { StripOptions } from '@/lib/engine/types';
import { useDialogAccessibility } from '@/lib/ui/useDialogAccessibility';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  options: StripOptions;
  onChangeOptions: (opts: StripOptions) => void;
  isServerMode: boolean;
  onToggleServerMode: (val: boolean) => void;
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex w-11 h-6 rounded-full border-2 border-foreground transition-colors shrink-0 ${
        checked ? 'bg-foreground' : 'bg-background'
      }`}
    >
      <span
        className={`inline-block w-4 h-4 rounded-full mt-0.5 transition-transform ${
          checked
            ? 'translate-x-[20px] bg-background'
            : 'translate-x-0.5 bg-foreground'
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
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogAccessibility(isOpen, onClose, dialogRef);
  if (!isOpen) return null;

  const updateOpt = <K extends keyof StripOptions>(
    key: K,
    val: StripOptions[K]
  ) => {
    onChangeOptions({ ...options, [key]: val });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        tabIndex={-1}
        className="relative w-full max-w-lg border-2 border-foreground rounded-[4px] bg-background text-foreground flex flex-col max-h-[90dvh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-foreground">
          <div>
            <h3
              id="settings-dialog-title"
              className="text-[16px] font-semibold text-foreground leading-none"
            >
              Settings
            </h3>
            <p className="text-[12px] text-text-sec mt-1">
              Stripping &amp; export options
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-[4px] text-text-sec hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 space-y-6">
          {/* Quality Preservation */}
          <section className="space-y-3">
            <h4 className="text-[12px] font-semibold text-text-sec">
              Quality preservation
            </h4>

            <label className="flex items-center justify-between gap-4 py-3 border-b border-border-subtle cursor-pointer select-none">
              <div>
                <span className="text-[14px] font-medium text-foreground block">
                  Preserve Color/Rendering Metadata
                </span>
                <span className="text-[12px] text-text-sec block mt-0.5 leading-relaxed">
                  Keeps ICC and color-interpretation chunks. Off by default for
                  stricter cleaning.
                </span>
              </div>
              <Toggle
                checked={options.keepIccProfile === true}
                onChange={(v) => updateOpt('keepIccProfile', v)}
              />
            </label>

            <label className="flex items-center justify-between gap-4 py-2 cursor-pointer select-none">
              <div>
                <span className="text-[14px] font-medium text-foreground block">
                  Preserve Image Orientation
                </span>
                <span className="text-[12px] text-text-sec block mt-0.5 leading-relaxed">
                  Retains the EXIF orientation tag where supported. Off by
                  default.
                </span>
              </div>
              <Toggle
                checked={options.keepOrientation === true}
                onChange={(v) => updateOpt('keepOrientation', v)}
              />
            </label>
          </section>

          {/* Filename Suffix */}
          <section className="space-y-2">
            <h4 className="text-[12px] font-semibold text-text-sec">
              Filename suffix
            </h4>
            <input
              type="text"
              value={options.filenameSuffix ?? ''}
              maxLength={40}
              onChange={(e) => updateOpt('filenameSuffix', e.target.value)}
              placeholder='e.g. "_clean" or leave blank'
              className="w-full px-3 py-2 text-[13px] rounded-[4px] border-2 border-foreground bg-background text-foreground placeholder:text-text-ter focus:outline-none"
            />
            <p className="text-[12px] text-text-sec">
              <code className="font-mono text-foreground">photo.jpg</code> →{' '}
              <code className="font-mono text-foreground">
                photo{options.filenameSuffix || ''}.jpg
              </code>
            </p>
          </section>

          {/* ZIP Structure */}
          <section className="space-y-2">
            <h4 className="text-[12px] font-semibold text-text-sec">
              ZIP archive
            </h4>
            <label className="flex items-center justify-between gap-4 py-1 cursor-pointer select-none">
              <div>
                <span className="text-[14px] font-medium text-foreground block">
                  Preserve Folder Structure
                </span>
                <span className="text-[12px] text-text-sec block mt-0.5">
                  Keep subfolder tree when uploading nested folders.
                </span>
              </div>
              <Toggle
                checked={options.preserveFolderStructure === true}
                onChange={(v) => updateOpt('preserveFolderStructure', v)}
              />
            </label>
          </section>

          {/* Processing Mode */}
          <section className="space-y-2">
            <h4 className="text-[12px] font-semibold text-text-sec">
              Processing mode
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onToggleServerMode(false)}
                className={`p-3.5 rounded-[4px] border-2 text-left transition-colors ${
                  !isServerMode
                    ? 'border-foreground bg-black/[0.04] dark:bg-white/[0.08]'
                    : 'border-border-subtle bg-background hover:border-foreground'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-semibold text-foreground">
                    Client-Side
                  </span>
                  {!isServerMode && <Check className="w-4 h-4 text-foreground" />}
                </div>
                <p className="text-[11px] text-text-sec leading-relaxed">
                  File bytes stay in your browser for processing.
                </p>
              </button>

              <button
                type="button"
                onClick={() => onToggleServerMode(true)}
                className={`p-3.5 rounded-[4px] border-2 text-left transition-colors ${
                  isServerMode
                    ? 'border-foreground bg-black/[0.04] dark:bg-white/[0.08]'
                    : 'border-border-subtle bg-background hover:border-foreground'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-semibold text-foreground">
                    Server-Side
                  </span>
                  {isServerMode && <Check className="w-4 h-4 text-foreground" />}
                </div>
                <p className="text-[11px] text-text-sec leading-relaxed">
                  Uploads selected files (max 20 MB each, 40 files per batch)
                  for server processing.
                </p>
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t-2 border-foreground flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-[13px] font-semibold rounded-[4px] bg-foreground text-background hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
