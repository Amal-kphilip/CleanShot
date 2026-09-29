'use client';

import React from 'react';
import { Header } from '@/components/Header';
import { ShieldCheck, Lock, EyeOff, Server, HardDrive, Sparkles } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 space-y-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Zero-Knowledge Architecture</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-surface-900 dark:text-white">
            Your Photos Never Leave Your Device
          </h1>
          <p className="text-base text-surface-600 dark:text-surface-400 max-w-xl mx-auto">
            CleanShot was built from day one as a client-side first application. Privacy is not an afterthought—it is the core architecture.
          </p>
        </div>

        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-50 dark:bg-brand-950 text-brand-600">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-surface-900 dark:text-white">
                1. 100% In-Browser WebAssembly / Worker Execution
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-surface-600 dark:text-surface-400 leading-relaxed pl-11">
              When you drop photos into CleanShot, they are processed in parallel on your local CPU cores using Web Workers and binary parsers. No image bytes are sent over the network. You can disconnect your internet and CleanShot will continue to work flawlessly.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 text-emerald-600">
                <EyeOff className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-surface-900 dark:text-white">
                2. Zero Analytics on Image Contents
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-surface-600 dark:text-surface-400 leading-relaxed pl-11">
              We do not track, index, log, or fingerprint any filenames, image dimensions, GPS coordinates, or camera serials.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600">
                <Server className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-surface-900 dark:text-white">
                3. Server-Side Fallback Mode Isolation
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-surface-600 dark:text-surface-400 leading-relaxed pl-11">
              If server-side fallback mode is explicitly enabled for unsupported device environments, batches are processed in an ephemeral in-memory sandbox and purged instantly upon download or automatically within a strict 15-minute TTL.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
