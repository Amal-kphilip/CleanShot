'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { Header } from '@/components/Header';

export function ToolShell({
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
      <main className="flex-1 w-full flex flex-col gap-8 sm:gap-10 py-4 sm:py-6">
        <div className="space-y-3">
          {showBack && (
            <Link
              href="/tools"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-sec hover:text-foreground underline underline-offset-4"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> All tools
            </Link>
          )}
          <h1 className="text-[20px] sm:text-[26px] font-medium leading-[1.2] tracking-[-0.01em] text-foreground">
            {title} {accent && <span>{accent}</span>}
          </h1>
          <p className="text-[14px] sm:text-[15px] text-text-sec leading-relaxed max-w-2xl">
            {description}
          </p>
        </div>

        <div className="h-[3px] w-full bg-foreground" />

        {children}
      </main>
      <footer className="w-full py-8 sm:py-12 mt-auto">
        <div className="w-full flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-end text-[12px] font-medium">
          <p className="text-text-sec">Built for everyday digital hygiene.</p>
          <Link
            href="/"
            className="underline underline-offset-4 hover:text-foreground text-text-sec"
          >
            Back to metadata remover
          </Link>
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
      className="px-4 py-2.5 rounded-[4px] bg-foreground text-background hover:opacity-90 text-[13px] font-semibold inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <ArrowUpRight className="h-4 w-4" />
      {children}
    </button>
  );
}
