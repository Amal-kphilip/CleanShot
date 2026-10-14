'use client';

import React from 'react';
import { Header } from '@/components/Header';
import { Lock, EyeOff, Server } from 'lucide-react';

export default function PrivacyPage() {
  const principles = [
    {
      icon: Lock,
      title: '1. Local Processing by Default',
      desc: 'Client-Side mode processes supported images in your browser using Web Workers where available. The local queue is limited to 50 MB per file and 100 MB total to reduce memory pressure. In this mode, the image file is not uploaded for processing. The site itself still requires a network connection to load unless it has been cached; fully offline behavior depends on the browser cache.',
    },
    {
      icon: EyeOff,
      title: '2. File Contents Are Not Sent in Client-Side Mode',
      desc: 'The client-side workflow reads files locally to inspect and clean them. The app does not need to transmit their bytes to perform this processing. Browser extensions, developer tools, or your network environment may affect what you observe, so you can verify the behavior in the browser Network panel.',
    },
    {
      icon: Server,
      title: '3. Optional Server-Side Mode',
      desc: 'If you explicitly select Server-Side mode in Settings, original files are uploaded and buffered in application memory while processing. Only successful cleaned outputs are retained in the in-memory job store for download, with a nominal 15-minute expiry or earlier deletion when cleared. This is not a secure-erasure guarantee; restarts and multi-instance/serverless hosting can affect job availability. Do not use this mode for confidential images you do not want to upload.',
    },
  ];

  return (
    <div className="flex flex-col min-h-dvh">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 space-y-12 sm:space-y-16">
        <div className="text-center space-y-3">
          <h1 className="display-serif text-[38px] sm:text-[56px] font-normal tracking-[-0.045em] text-foreground leading-[0.98]">
            Privacy by{' '}
            <span className="bg-gradient-to-r from-lime-400 via-lime-300 to-lime-500 dark:from-lime-300 dark:via-lime-200 dark:to-lime-400 bg-clip-text text-transparent">
              Design
            </span>
          </h1>
          <p className="text-[15px] sm:text-[17px] text-text-sec max-w-lg mx-auto font-normal leading-relaxed">
            Local processing is the default. Server-Side mode is optional and uploads files; choose the mode that matches your privacy needs.
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
        <p>CleanShot · Photo Metadata Privacy · Local processing by default</p>
        <p className="text-[11px]">Server mode uploads only when explicitly enabled in Settings</p>
      </footer>
    </div>
  );
}
