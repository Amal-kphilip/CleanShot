'use client';

import React from 'react';
import { Header } from '@/components/Header';
import { CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function HowItWorksPage() {
  const formats = [
    {
      title: '1. JPEG / JFIF',
      desc: 'JPEG files are structured as markers. CleanShot parses marker pairs between 0xFFD8 (SOI) and 0xFFDA (SOS). It surgically drops 0xFFE1 (EXIF/XMP), 0xFFFE (COM), and C2PA markers, preserves 0xFFE2 ICC profiles, and keeps the Huffman tables (DHT), Quantization tables (DQT), and entropy-coded DCT scan payload 100% byte-exact.',
    },
    {
      title: '2. PNG',
      desc: 'PNG files are sequences of 4-byte typed chunks. CleanShot removes ancillary chunks (tEXt, zTXt, iTXt, eXIf, tIME, dSIG) while passing through critical rendering chunks (IHDR, PLTE, IDAT, IEND) with bit-exact raster data.',
    },
    {
      title: '3. WebP',
      desc: 'WebP files use a RIFF container. CleanShot drops EXIF and XMP FourCC chunks, updates the VP8X header feature flags bitmask, and recalculates the RIFF container length without decoding the VP8/VP8L compressed bitstream.',
    },
    {
      title: '4. SVG Vector Graphics',
      desc: 'Vector graphics are sanitized to remove XML comments, <metadata>, RDF tags, and proprietary editor metadata (Inkscape, Adobe Illustrator, Figma) while preserving visual paths, styles, and dimensions.',
    },
  ];

  return (
    <div className="min-h-dvh flex flex-col bg-[#FAFAFA] dark:bg-[#0C0C10] text-n-900 dark:text-n-100 selection:bg-accent/20 selection:text-accent">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-12 sm:space-y-16">
        {/* Title */}
        <div className="text-center space-y-3">
          <h1 className="text-[30px] sm:text-[46px] font-semibold tracking-tight text-n-900 dark:text-white leading-[1.15]">
            How Lossless Stripping <span className="text-accent dark:text-accent-dark">Works</span>
          </h1>
          <p className="text-[15px] sm:text-[17px] text-n-500 dark:text-n-400 max-w-2xl mx-auto font-normal leading-relaxed">
            Traditional tools decode and re-compress images, causing quality loss. CleanShot operates directly on the binary byte stream without touching pixel data.
          </p>
        </div>

        {/* Comparison: Lossy vs CleanShot Lossless */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Traditional Way */}
          <div className="p-6 rounded-2xl bg-white dark:bg-white/[0.025] border border-n-200 dark:border-white/[0.08] space-y-4">
            <div className="flex items-center gap-2 text-n-700 dark:text-n-300 font-semibold text-[15px]">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Standard Tools (Lossy Re-encoding)</span>
            </div>
            <ol className="text-[13px] text-n-500 dark:text-n-400 space-y-2.5 list-decimal pl-4 leading-relaxed">
              <li>Decodes compressed JPEG/PNG into raw uncompressed pixels in memory.</li>
              <li>Re-compresses pixels with an encoder (e.g. libjpeg quality 85).</li>
              <li>Introduces generational artifacts, blurriness, and color shifting.</li>
              <li>Alters the original binary image data irreversibly.</li>
            </ol>
          </div>

          {/* CleanShot Lossless Way */}
          <div className="p-6 rounded-2xl bg-white dark:bg-white/[0.025] border border-emerald-500/30 dark:border-emerald-500/20 space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-[15px]">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>CleanShot (Byte-Stream Segment Stripping)</span>
            </div>
            <ol className="text-[13px] text-n-500 dark:text-n-400 space-y-2.5 list-decimal pl-4 leading-relaxed">
              <li>Scans binary container headers for marker segments (0xFFE1, 0xFFFE, tEXt).</li>
              <li>Slices out auxiliary metadata segments directly from the byte array.</li>
              <li>Copies entropy-coded DCT scan stream byte-for-byte.</li>
              <li>100% pixel-identical output with zero compression loss.</li>
            </ol>
          </div>
        </div>

        {/* Format Specific Deep Dive */}
        <div className="space-y-4">
          <h2 className="text-[20px] font-semibold text-n-900 dark:text-white">
            Format-by-Format Guarantees
          </h2>

          <div className="space-y-3">
            {formats.map((fmt) => (
              <div
                key={fmt.title}
                className="p-5 rounded-2xl bg-white dark:bg-white/[0.025] border border-n-200 dark:border-white/[0.08] space-y-1.5"
              >
                <h3 className="text-[14px] font-semibold text-n-900 dark:text-white">
                  {fmt.title}
                </h3>
                <p className="text-[13px] text-n-500 dark:text-n-400 leading-relaxed font-normal">
                  {fmt.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="p-8 sm:p-10 rounded-2xl bg-white dark:bg-white/[0.025] border border-n-200 dark:border-white/[0.08] text-center space-y-4">
          <h3 className="text-[20px] font-semibold text-n-900 dark:text-white">Ready to strip metadata losslessly?</h3>
          <p className="text-[13px] text-n-500 dark:text-n-400 max-w-md mx-auto leading-relaxed">
            100% in-browser, zero server uploads, instant batch processing.
          </p>
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent dark:bg-accent-dark hover:opacity-90 active:scale-95 text-white font-semibold text-[13px] shadow-sm transition-all"
            >
              <span>Start Stripping Photos</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
