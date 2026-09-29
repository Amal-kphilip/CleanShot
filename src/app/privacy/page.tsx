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
    <div className="min-h-dvh flex flex-col bg-[#FAFAFA] dark:bg-[#0C0C10] text-n-900 dark:text-n-100 selection:bg-accent/20 selection:text-accent">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-10 sm:space-y-12">
        <div className="text-center space-y-3">
          <h1 className="text-[30px] sm:text-[46px] font-semibold tracking-tight text-n-900 dark:text-white leading-[1.15]">
            Privacy by <span className="text-accent dark:text-accent-dark">Design</span>
          </h1>
          <p className="text-[15px] sm:text-[17px] text-n-500 dark:text-n-400 max-w-lg mx-auto font-normal leading-relaxed">
            Your photos never leave your device. CleanShot is engineered from the ground up as a zero-knowledge architecture.
          </p>
        </div>

        <div className="space-y-4">
          {principles.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="p-6 rounded-2xl bg-white dark:bg-white/[0.025] border border-n-200 dark:border-white/[0.08] space-y-2.5"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-n-100 dark:bg-white/[0.06] text-n-700 dark:text-n-300 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <h3 className="text-[15px] font-semibold text-n-900 dark:text-white">
                    {item.title}
                  </h3>
                </div>
                <p className="text-[13px] text-n-500 dark:text-n-400 leading-relaxed font-normal pl-11">
                  {item.desc}
                </p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
