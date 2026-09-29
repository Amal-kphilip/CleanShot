'use client';

import React from 'react';
import { Header } from '@/components/Header';

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

  return (
    <div className="min-h-dvh flex flex-col bg-[#FAFAFA] dark:bg-[#0C0C10] text-n-900 dark:text-n-100 selection:bg-accent/20 selection:text-accent">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-10 sm:space-y-12">
        <div className="text-center space-y-3">
          <h1 className="text-[30px] sm:text-[46px] font-semibold tracking-tight text-n-900 dark:text-white leading-[1.15]">
            Frequently Asked <span className="text-accent dark:text-accent-dark">Questions</span>
          </h1>
          <p className="text-[15px] sm:text-[17px] text-n-500 dark:text-n-400 max-w-lg mx-auto font-normal leading-relaxed">
            Everything you need to know about photo metadata privacy and lossless processing.
          </p>
        </div>

        <div className="space-y-3.5">
          {faqs.map((item, idx) => (
            <div
              key={idx}
              className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-white/[0.025] border border-n-200 dark:border-white/[0.08] space-y-2"
            >
              <h3 className="text-[15px] font-semibold text-n-900 dark:text-white">
                {item.q}
              </h3>
              <p className="text-[13px] text-n-500 dark:text-n-400 leading-relaxed font-normal">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
