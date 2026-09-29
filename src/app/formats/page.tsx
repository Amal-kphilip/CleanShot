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
    <div className="min-h-dvh flex flex-col bg-[#FAFAFA] dark:bg-[#0C0C10] text-n-900 dark:text-n-100 selection:bg-accent/20 selection:text-accent">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 sm:py-16 space-y-10 sm:space-y-12">
        <div className="text-center space-y-3">
          <h1 className="text-[30px] sm:text-[46px] font-semibold tracking-tight text-n-900 dark:text-white leading-[1.15]">
            Supported <span className="text-accent dark:text-accent-dark">Formats</span>
          </h1>
          <p className="text-[15px] sm:text-[17px] text-n-500 dark:text-n-400 max-w-lg mx-auto font-normal leading-relaxed">
            Lossless segment-level stripping across raster, vector, next-generation, and camera RAW formats.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {formats.map((fmt) => (
            <div
              key={fmt.name}
              className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-white/[0.025] border border-n-200 dark:border-white/[0.08] space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-semibold text-n-900 dark:text-white">
                    {fmt.name}
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-n-100 dark:bg-white/[0.06] text-n-600 dark:text-n-400 border border-n-200/60 dark:border-white/[0.06]">
                    {fmt.ext}
                  </span>
                </div>

                <div className="text-[12px] text-n-500 dark:text-n-400 space-y-1.5 leading-relaxed">
                  <p>
                    <span className="font-medium text-n-700 dark:text-n-300">Method:</span> {fmt.method}
                  </p>
                  <p>
                    <span className="font-medium text-n-700 dark:text-n-300">Removed:</span> {fmt.tagsStripped}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-n-100 dark:border-white/[0.06] flex items-center gap-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>{fmt.guarantee}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
