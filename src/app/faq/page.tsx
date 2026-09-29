'use client';

import React from 'react';
import { Header } from '@/components/Header';
import { HelpCircle, ChevronDown } from 'lucide-react';

export default function FaqPage() {
  const faqs = [
    {
      q: 'What is EXIF metadata and why should I strip it?',
      a: 'EXIF (Exchangeable Image File Format) is invisible data automatically recorded inside your photos by digital cameras and smartphones. It often contains your exact GPS home location, device serial numbers, lens info, full names, and timestamps. When uploaded to marketplaces, forums, or shared with third parties, this information exposes your private physical location and equipment fingerprints.',
    },
    {
      q: 'Does stripping metadata reduce or degrade photo quality?',
      a: 'Never with CleanShot! Many generic image editors decode the image into uncompressed pixels and re-encode it with a lossy JPEG compression algorithm (causing compression artifacts and color shifts). CleanShot uses byte-level segment stripping: it surgically drops the APPn/COM/tEXt chunks from the binary file header and leaves the DCT entropy bitstream 100% untouched.',
    },
    {
      q: 'Why is "Keep ICC Profile" enabled by default?',
      a: 'An ICC profile tells monitors and operating systems how to interpret colors (e.g. Display P3 on iPhones or Adobe RGB on pro DSLRs). If you strip the ICC profile, wide-gamut photos can look dull, washed out, or have shifted skin tones. CleanShot keeps the ICC profile intact while stripping all personal identifiers.',
    },
    {
      q: 'Can CleanShot process 100+ files at once?',
      a: 'Yes. CleanShot uses a concurrent Web Worker pool that distributes work across your CPU cores in parallel. It can effortlessly process hundreds of photos in seconds and package them into an uncompressed STORE-mode ZIP for instant download.',
    },
    {
      q: 'Do my photos get uploaded to a remote server?',
      a: 'No. CleanShot runs 100% client-side in your web browser. All byte-level parsing and ZIP archiving happens on your local device. Even if you disconnect from the internet, CleanShot works completely offline.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 space-y-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 text-xs font-semibold border border-brand-200 dark:border-brand-800">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Frequently Asked Questions</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-surface-900 dark:text-white">
            Common Questions & Answers
          </h1>
          <p className="text-base text-surface-600 dark:text-surface-400 max-w-xl mx-auto">
            Everything you need to know about photo metadata privacy and lossless processing.
          </p>
        </div>

        <div className="space-y-4">
          {faqs.map((item, idx) => (
            <div
              key={idx}
              className="p-6 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 space-y-2"
            >
              <h3 className="text-base font-bold text-surface-900 dark:text-white">
                {item.q}
              </h3>
              <p className="text-xs sm:text-sm text-surface-600 dark:text-surface-400 leading-relaxed">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
