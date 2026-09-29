'use client';

import React from 'react';
import { Header } from '@/components/Header';
import { Lock, EyeOff, Server } from 'lucide-react';

export default function PrivacyPage() {
  const principles = [
    {
      icon: Lock,
      title: '1. 100% In-Browser Execution',
      desc: 'When you drop photos into CleanShot, they are processed locally in parallel on your device using Web Workers and binary segment parsers. No image bytes are ever transmitted over the network. You can disconnect your device from the internet and CleanShot will continue to work without disruption.',
    },
    {
      icon: EyeOff,
      title: '2. Zero Analytics on File Contents',
      desc: 'We do not inspect, log, fingerprint, or track any filenames, image dimensions, GPS coordinates, camera serials, or visual content. All metadata is ephemeral and destroyed as soon as the browser tab is closed.',
    },
    {
      icon: Server,
      title: '3. Isolated Server Fallback Sandbox',
      desc: 'If server-side fallback mode is explicitly enabled for low-memory or legacy environments, batches are processed in an ephemeral in-memory sandbox and purged instantly upon download or automatically within a strict 15-minute TTL.',
    },
  ];

  return (
    <div className="flex flex-col min-h-dvh">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 space-y-12 sm:space-y-16">
        <div className="text-center space-y-3">
          <h1 className="text-[36px] sm:text-[50px] font-semibold tracking-headline text-foreground leading-tight-title">
            Privacy by{' '}
            <span className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-500 dark:from-indigo-400 dark:via-indigo-300 dark:to-violet-400 bg-clip-text text-transparent">
              Design
            </span>
          </h1>
          <p className="text-[15px] sm:text-[17px] text-text-sec max-w-lg mx-auto font-normal leading-relaxed">
            Your photos never leave your device. CleanShot is engineered from the ground up as a zero-knowledge architecture.
          </p>
        </div>

        <div className="space-y-4">
          {principles.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="p-6 sm:p-7 rounded-card liquid-glass hover:shadow-floating hover:border-black/[0.12] dark:hover:border-white/[0.14] apple-spring space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-small liquid-glass text-foreground flex items-center justify-center shrink-0 shadow-xs">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-[16px] font-semibold tracking-heading text-foreground">
                    {item.title}
                  </h3>
                </div>
                <p className="text-[13px] text-text-sec leading-relaxed font-normal pl-11">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="mt-auto border-t border-border-subtle py-8 px-4 text-center text-[12px] text-text-ter space-y-1">
        <p>CleanShot · Lossless Photo Privacy · 100% Client-Side</p>
        <p className="text-[11px]">Zero tracking · Zero server uploads · Pure byte manipulation</p>
      </footer>
    </div>
  );
}
