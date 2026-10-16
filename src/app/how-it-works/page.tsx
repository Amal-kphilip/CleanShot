'use client';

import React from 'react';
import { Header } from '@/components/Header';
import { CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function HowItWorksPage() {
  const formats = [
    {
      title: '1. JPEG / JFIF',
      desc: 'JPEG files are structured as markers. StripMeta removes APP metadata, comments, JFIF/JFXX density and thumbnail data, ICC metadata, and trailing payloads by default while retaining the compressed scan without re-encoding. Color/rendering metadata and a minimal orientation-only EXIF block can be explicitly preserved in Settings; those options retain metadata and can affect color/orientation behavior.',
    },
    {
      title: '2. PNG',
      desc: 'PNG files are sequences of typed chunks. StripMeta removes text/XMP, timestamps, EXIF, C2PA (including caBX), digital signatures, physical-size/resolution chunks, color metadata, and unknown ancillary chunks by default. Core raster/transparency/animation data is preserved; unknown critical chunks and invalid checksums return an error.',
    },
    {
      title: '3. WebP',
      desc: 'WebP files use a RIFF container. StripMeta drops EXIF, XMP, ICC and unknown optional chunks by default, synchronizes VP8X flags with chunks that remain, and recalculates RIFF length without decoding the VP8/VP8L bitstream.',
    },
    {
      title: '4. SVG Vector Graphics',
      desc: 'Vector markup is sanitized to remove selected XML comments, metadata/RDF blocks, editor-specific attributes, and simple script or inline-handler patterns. Since the SVG text changes, exact pixel equivalence is not asserted; review untrusted SVGs with care.',
    },
  ];

  return (
    <div className="flex flex-col min-h-dvh">
      <Header />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 space-y-12 sm:space-y-16">
        {/* Title */}
        <div className="text-center space-y-3">
          <h1 className="display-serif text-[38px] sm:text-[56px] font-normal tracking-[-0.045em] text-foreground leading-[0.98]">
            How Metadata Stripping{' '}
            <span className="bg-gradient-to-r from-lime-400 via-lime-300 to-lime-500 dark:from-lime-300 dark:via-lime-200 dark:to-lime-400 bg-clip-text text-transparent">
              Works
            </span>
          </h1>
          <p className="text-[15px] sm:text-[17px] text-text-sec max-w-2xl mx-auto font-normal leading-relaxed">
            Many editors re-encode an image when saving. For supported formats, CleanShot removes metadata from the file structure without re-encoding the image data.
          </p>
        </div>

        {/* Comparison: Lossy vs CleanShot Lossless */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Traditional Way */}
          <div className="p-6 sm:p-7 rounded-card liquid-glass space-y-4">
            <div className="flex items-center gap-2 text-foreground font-semibold text-[15px]">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Standard Tools (Lossy Re-encoding)</span>
            </div>
            <ol className="text-[13px] text-text-sec space-y-2.5 list-decimal pl-4 leading-relaxed">
              <li>Decodes compressed JPEG/PNG into raw uncompressed pixels in memory.</li>
              <li>Re-compresses pixels with an encoder (e.g. libjpeg quality 85).</li>
              <li>Introduces generational artifacts, blurriness, and color shifting.</li>
              <li>Alters the original binary image data irreversibly.</li>
            </ol>
          </div>

          {/* CleanShot Lossless Way */}
          <div className="p-6 sm:p-7 rounded-card liquid-glass border-emerald-500/30 dark:border-emerald-500/20 space-y-4 shadow-glass">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-[15px]">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>CleanShot (Byte-Stream Segment Stripping)</span>
            </div>
            <ol className="text-[13px] text-text-sec space-y-2.5 list-decimal pl-4 leading-relaxed">
              <li>Scans binary container headers for marker segments (0xFFE1, 0xFFFE, tEXt).</li>
              <li>Slices out auxiliary metadata segments directly from the byte array.</li>
              <li>Copies entropy-coded DCT scan stream byte-for-byte.</li>
              <li>The supported parser avoids image re-encoding; output structure is checked before a file is marked successful.</li>
            </ol>
          </div>
        </div>

        {/* Format Specific Deep Dive */}
        <div className="space-y-4">
          <h2 className="text-[20px] font-semibold tracking-heading text-foreground">
            Format-by-Format Behavior
          </h2>

          <div className="space-y-3">
            {formats.map((fmt) => (
              <div
                key={fmt.title}
                className="p-5 sm:p-6 rounded-card liquid-glass hover:shadow-floating hover:border-black/[0.12] dark:hover:border-white/[0.14] apple-spring space-y-1.5"
              >
                <h3 className="text-[15px] font-semibold text-foreground">
                  {fmt.title}
                </h3>
                <p className="text-[13px] text-text-sec leading-relaxed font-normal">
                  {fmt.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="p-8 sm:p-10 rounded-card liquid-glass text-center space-y-4 shadow-glass">
          <h3 className="text-[22px] font-semibold text-foreground">Ready to strip metadata losslessly?</h3>
          <p className="text-[14px] text-text-sec max-w-md mx-auto leading-relaxed">
            Browser processing by default, bounded worker concurrency, and explicit errors for unsupported formats.
          </p>
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-pill bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 active:scale-[0.97] text-white font-semibold text-[13px] shadow-accent-button apple-spring"
            >
              <span>Start Stripping Photos</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
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
