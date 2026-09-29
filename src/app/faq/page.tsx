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
      a: 'Never with CleanShot. Generic photo editors decode the image into uncompressed pixels and re-compress it with a lossy JPEG encoder (causing generational compression artifacts and color shifts). CleanShot uses byte-level segment stripping: it removes auxiliary metadata segments (APPn, COM, tEXt) directly from the binary stream without touching the DCT entropy payload.',
    },
    {
      q: 'Why is "Keep ICC Profile" enabled by default?',
      a: 'An ICC profile tells displays and operating systems how to interpret colors (e.g. Display P3 on iPhones or Adobe RGB on cameras). If you strip the ICC profile, wide-gamut photos can look dull, washed out, or have shifted skin tones. CleanShot keeps the color profile intact while stripping all personal identifiers.',
    },
    {
      q: 'Can CleanShot process 100+ photos at once?',
      a: 'Yes. CleanShot uses a concurrent Web Worker pool that distributes work across your CPU cores in parallel. It processes hundreds of photos in seconds and packages them into an uncompressed STORE-mode ZIP for instant download.',
    },
    {
      q: 'Do my photos get uploaded to a remote server?',
      a: 'No. CleanShot runs 100% client-side in your web browser. All byte manipulation and ZIP packaging happens on your local device. Even if you disconnect from the internet, CleanShot works completely offline.',
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
          <h1 className="text-[36px] sm:text-[50px] font-semibold tracking-headline text-foreground leading-tight-title">
            Frequently Asked{' '}
            <span className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-500 dark:from-indigo-400 dark:via-indigo-300 dark:to-violet-400 bg-clip-text text-transparent">
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
        <p>CleanShot · Lossless Photo Privacy · 100% Client-Side</p>
        <p className="text-[11px]">Zero tracking · Zero server uploads · Pure byte manipulation</p>
      </footer>
    </div>
  );
}
