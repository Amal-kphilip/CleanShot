'use client';

import React from 'react';
import { Header } from '@/components/Header';
import { CheckCircle2 } from 'lucide-react';

export default function FormatsPage() {
  const formats = [
    {
      name: 'JPEG / JPG',
      ext: '.jpg, .jpeg, .jfif',
      method: 'APPn / COM segment stripper',
      tagsStripped: 'EXIF (APP1), XMP (APP1), Comments (COM), Photoshop 8BIM / IPTC (APP13), FlashPix (APP2), Vendor tags (APP3-APP15)',
      guarantee: '100% untouched DCT entropy stream. Zero recompression artifacts.',
    },
    {
      name: 'PNG',
      ext: '.png',
      method: 'Ancillary chunk filter',
      tagsStripped: 'tEXt, zTXt, iTXt, eXIf, tIME, dSIG (C2PA), prPt',
      guarantee: 'Preserves critical IHDR, PLTE, IDAT, IEND chunks. 100% bit-exact pixel raster.',
    },
    {
      name: 'WebP',
      ext: '.webp',
      method: 'RIFF container sub-chunk stripper',
      tagsStripped: 'EXIF FourCC chunk, XMP FourCC chunk, updates VP8X feature flag bitmask',
      guarantee: 'VP8 / VP8L raster frames untouched. Zero loss in lossy or lossless WebP.',
    },
    {
      name: 'HEIF / HEIC',
      ext: '.heic, .heif',
      method: 'ISOBMFF meta container cleaner',
      tagsStripped: 'Standalone exif / xml boxes, item references in meta box',
      guarantee: 'H.265 / HEVC media bitstreams in mdat box 100% preserved.',
    },
    {
      name: 'AVIF',
      ext: '.avif',
      method: 'ISOBMFF meta container cleaner',
      tagsStripped: 'exif, xml / XMP boxes, auxiliary metadata items',
      guarantee: 'AV1 image video bitstreams preserved without re-encoding.',
    },
    {
      name: 'GIF',
      ext: '.gif',
      method: 'Block stream parser',
      tagsStripped: 'Comment Extensions (0x21 0xFE), Plain Text Extensions, XMP Application Extensions',
      guarantee: 'Preserves Graphic Control Extensions (transparency & timing) and LZW raster data.',
    },
    {
      name: 'TIFF & RAW',
      ext: '.tif, .tiff, .dng, .cr2, .nef, .arw',
      method: 'IFD0 pointer sanitizer',
      tagsStripped: 'ExifIFDPointer, GPSInfoPointer, XMP, IPTC, Make, Model, Software, Artist',
      guarantee: 'Preserves StripOffsets, TileOffsets, and SubIFD raw CFA/Bayer pixel arrays.',
    },
    {
      name: 'SVG Vector Graphics',
      ext: '.svg',
      method: 'XML / DOM metadata sanitizer',
      tagsStripped: '<metadata>, <rdf:RDF>, XML comments, Inkscape/Illustrator editor tags, script tags',
      guarantee: 'Preserves SVG paths, gradients, shapes, viewbox, and visual styling.',
    },
  ];

  return (
    <div className="flex flex-col min-h-dvh">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 space-y-12 sm:space-y-16">
        <div className="text-center space-y-3">
          <h1 className="text-[36px] sm:text-[50px] font-semibold tracking-headline text-foreground leading-tight-title">
            Supported{' '}
            <span className="bg-gradient-to-r from-indigo-500 via-indigo-600 to-violet-500 dark:from-indigo-400 dark:via-indigo-300 dark:to-violet-400 bg-clip-text text-transparent">
              Formats
            </span>
          </h1>
          <p className="text-[15px] sm:text-[17px] text-text-sec max-w-lg mx-auto font-normal leading-relaxed">
            Lossless segment-level stripping across raster, vector, next-generation, and camera RAW formats.
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

              <div className="pt-3.5 border-t border-border-subtle flex items-center gap-2 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{fmt.guarantee}</span>
              </div>
            </div>
          ))}
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
