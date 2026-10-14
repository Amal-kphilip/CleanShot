'use client';

import React from 'react';
import { Header } from '@/components/Header';
import { CheckCircle2, CircleAlert } from 'lucide-react';

export default function FormatsPage() {
  const formats = [
    {
      name: 'JPEG / JPG', ext: '.jpg, .jpeg, .jfif', supported: true,
      method: 'JPEG marker parser',
      tagsStripped: 'EXIF/XMP APP1 content (only orientation may be retained when enabled), comments, selected APPn vendor metadata, and trailing payload after EOI.',
      guarantee: 'Removes selected metadata segments without re-encoding the compressed image scan.',
    },
    {
      name: 'PNG', ext: '.png', supported: true,
      method: 'PNG chunk filter',
      tagsStripped: 'Text chunks, timestamps, digital-signature/C2PA chunks, and known metadata blocks. Only EXIF orientation may be retained when enabled. Unknown chunks cause a safe error rather than being passed through.',
      guarantee: 'Preserves supported image-data and required structural chunks. Malformed streams are reported as errors.',
    },
    {
      name: 'WebP', ext: '.webp', supported: true,
      method: 'RIFF container parser',
      tagsStripped: 'EXIF and XMP chunks, with container size and feature flags updated by the parser. Only EXIF orientation may be retained when enabled; unknown chunks cause a safe error.',
      guarantee: 'Does not decode or re-encode the VP8/VP8L image bitstream.',
    },
    {
      name: 'GIF', ext: '.gif', supported: true,
      method: 'GIF block parser',
      tagsStripped: 'Comment blocks and known XMP/C2PA application metadata. Unknown application extensions cause a safe error.',
      guarantee: 'Keeps image data blocks and animation timing structures in supported files.',
    },
    {
      name: 'SVG Vector Graphics', ext: '.svg', supported: true,
      method: 'SVG metadata sanitizer',
      tagsStripped: 'XML comments, metadata/RDF blocks, editor tags, and script elements.',
      guarantee: 'Vector markup is filtered without rasterizing the graphic; review third-party SVGs before opening.',
    },
    {
      name: 'HEIF / HEIC', ext: '.heic, .heif', supported: false,
      method: 'Not enabled for cleaning yet',
      tagsStripped: 'No changes are made.',
      guarantee: 'The original is left unchanged and processing returns an unsupported-format error.',
    },
    {
      name: 'AVIF', ext: '.avif', supported: false,
      method: 'Not enabled for cleaning yet',
      tagsStripped: 'No changes are made.',
      guarantee: 'The original is left unchanged and processing returns an unsupported-format error.',
    },
    {
      name: 'TIFF & Camera RAW', ext: '.tif, .tiff, .dng, .cr2, .nef, .arw', supported: false,
      method: 'Not enabled for cleaning yet',
      tagsStripped: 'No changes are made.',
      guarantee: 'Safe metadata removal requires a full offset-aware IFD rebuild; these formats are rejected for now.',
    },
    {
      name: 'BMP / JPEG XL', ext: '.bmp, .jxl', supported: false,
      method: 'Not enabled for cleaning yet',
      tagsStripped: 'No changes are made.',
      guarantee: 'These formats are explicitly reported as unsupported rather than marked as cleaned.',
    },
  ];

  return (
    <div className="flex flex-col min-h-dvh">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 space-y-12 sm:space-y-16">
        <div className="text-center space-y-3">
          <h1 className="display-serif text-[38px] sm:text-[56px] font-normal tracking-[-0.045em] text-foreground leading-[0.98]">
            Supported{' '}
            <span className="bg-gradient-to-r from-lime-400 via-lime-300 to-lime-500 dark:from-lime-300 dark:via-lime-200 dark:to-lime-400 bg-clip-text text-transparent">
              Formats
            </span>
          </h1>
          <p className="text-[15px] sm:text-[17px] text-text-sec max-w-lg mx-auto font-normal leading-relaxed">
            The formats currently supported for metadata removal, plus formats the engine recognizes but deliberately refuses to modify.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formats.map((fmt) => (
            <div
              key={fmt.name}
              className="p-6 rounded-card liquid-glass hover:shadow-floating hover:border-black/[0.12] dark:hover:border-white/[0.14] apple-spring space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-semibold tracking-heading text-foreground">
                    {fmt.name}
                  </h3>
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-pill bg-black/[0.04] dark:bg-white/[0.06] text-text-sec border border-border-glass">
                    {fmt.ext}
                  </span>
                </div>

                <div className="text-[13px] text-text-sec space-y-1.5 leading-relaxed">
                  <p>
                    <span className="font-medium text-foreground">Method:</span> {fmt.method}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Removed:</span> {fmt.tagsStripped}
                  </p>
                </div>
              </div>

              <div className={`pt-3.5 border-t border-border-subtle flex items-start gap-2 text-[12px] font-medium ${fmt.supported ? 'text-lime-600 dark:text-lime-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {fmt.supported ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" /> : <CircleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                <span>{fmt.guarantee}</span>
              </div>
            </div>
          ))}
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
