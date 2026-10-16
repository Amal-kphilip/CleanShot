'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Header } from '@/components/Header';
import { ChevronDown } from 'lucide-react';

export default function FaqPage() {
  const faqs = [
    {
      q: 'What is EXIF metadata and why should I strip it?',
      a: 'EXIF (Exchangeable Image File Format) is metadata automatically written inside your photos by digital cameras and smartphones. It frequently includes exact GPS coordinates of your home, device serial numbers, lens specifications, owner names, and timestamps. When uploaded to marketplaces, social media, or shared with third parties, this information exposes your private location and equipment fingerprints.',
    },
    {
      q: 'Does stripping metadata reduce or degrade photo quality?',
      a: 'For supported formats, CleanShot removes selected metadata/container structures without re-encoding the image data. Unsupported or malformed files are reported as errors rather than advertised as cleaned. Results should be checked for the formats and metadata you rely on.',
    },
    {
      q: 'Why are color and orientation preservation off by default?',
      a: 'Color profiles and EXIF orientation are metadata. StripMeta removes them by default for stricter metadata removal, but this can change color interpretation or the displayed orientation of some photos. You can opt in to preserve them in Settings; doing so intentionally retains rendering-related metadata.',
    },
    {
      q: 'Can CleanShot process 100+ photos at once?',
      a: 'The local processor uses a bounded Web Worker pool on supported browsers. Throughput depends on your device, file sizes, and format. Large batches can use substantial memory, so process in manageable groups.',
    },
    {
      q: 'Do my photos get uploaded to a remote server?',
      a: 'In Client-Side mode, image processing stays in your browser. If you explicitly switch to Server-Side in Settings, selected files are uploaded for processing and held in memory on that server instance until deleted or expired. Do not use server mode for files you do not want to upload.',
    },
  ];

  const [openIndexes, setOpenIndexes] = useState<number[]>([0]);

  const toggleIndex = (idx: number) => {
    setOpenIndexes((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  return (
    <div className="flex flex-col min-h-dvh">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 space-y-12 sm:space-y-16">
        <div className="text-center space-y-3">
          <h1 className="display-serif text-[38px] sm:text-[56px] font-normal tracking-[-0.045em] text-foreground leading-[0.98]">
            Frequently Asked{' '}
            <span className="bg-gradient-to-r from-lime-400 via-lime-300 to-lime-500 dark:from-lime-300 dark:via-lime-200 dark:to-lime-400 bg-clip-text text-transparent">
              Questions
            </span>
          </h1>
          <p className="text-[15px] sm:text-[17px] text-text-sec max-w-lg mx-auto font-normal leading-relaxed">
            Everything you need to know about photo metadata privacy and lossless processing.
          </p>
        </div>

        {/* Clean Accordion with Hairline Dividers and Smooth Height Animation */}
        <div className="rounded-card liquid-glass overflow-hidden divide-y divide-border-subtle shadow-glass">
          {faqs.map((item, idx) => {
            const isOpen = openIndexes.includes(idx);

            return (
              <div key={idx} className="transition-colors duration-200">
                <button
                  type="button"
                  onClick={() => toggleIndex(idx)}
                  className="w-full py-5 px-6 sm:px-8 text-left flex items-center justify-between gap-4 select-none group"
                  aria-expanded={isOpen}
                >
                  <span className="text-[15px] sm:text-[16px] font-semibold tracking-heading text-foreground group-hover:text-accent transition-colors">
                    {item.q}
                  </span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
                    className="shrink-0 text-text-ter group-hover:text-foreground transition-colors"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 sm:px-8 pb-5 text-[14px] text-text-sec leading-relaxed font-normal">
                        {item.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
