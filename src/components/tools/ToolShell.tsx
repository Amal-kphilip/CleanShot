'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, ShieldCheck } from 'lucide-react';
import { Header } from '@/components/Header';

export function ToolShell({
  eyebrow,
  showBack = true,
  title,
  accent,
  description,
  children,
}: {
  eyebrow?: string;
  showBack?: boolean;
  title: string;
  accent?: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col flex-1 w-full">
      <Header />
      <main className="flex-1 w-full flex flex-col gap-7 sm:gap-8 py-2 sm:py-4">
        <div className="flex flex-col items-center text-center space-y-3 pt-2 pb-2">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {showBack && (
              <Link
                href="/tools"
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-glass-card px-3 py-1 text-[12px] font-medium text-text-sec hover:text-foreground hover:border-emerald-500/40 transition-colors shadow-sm"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> All tools
              </Link>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[12px] font-semibold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              {eyebrow ?? '100% Local Browser Processing'}
            </span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold leading-tight tracking-tight text-foreground max-w-3xl">
            {title}{' '}
            {accent && (
              <span className="text-emerald-600 dark:text-emerald-400">
                {accent}
              </span>
            )}
          </h1>
          <p className="text-[14px] sm:text-[15px] text-text-sec leading-relaxed max-w-2xl">
            {description}
          </p>
        </div>

        {children}
      </main>
      <footer className="w-full py-6 sm:py-8 mt-10 border-t border-[var(--border-subtle)]">
        <div className="w-full flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center text-[12px] font-medium text-text-sec">
          <p>CleanShot — Private metadata &amp; watermark tools running locally in your browser.</p>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-foreground transition-colors">
              Metadata Remover
            </Link>
            <Link
              href="/gemini-watermark-remover"
              className="hover:text-foreground transition-colors"
            >
              Watermark Remover
            </Link>
            <Link href="/tools" className="hover:text-foreground transition-colors">
              All Tools
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function DownloadButton({
  onClick,
  children,
  disabled = false,
}: {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm text-[13px] font-semibold inline-flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <ArrowUpRight className="h-4 w-4" />
      {children}
    </button>
  );
}
