'use client';

import React from 'react';
import { Header } from '@/components/Header';
import { FileCheck, Shield, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

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
    <div className="min-h-screen flex flex-col bg-surface-50 dark:bg-surface-950 text-surface-900 dark:text-surface-100">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-12 space-y-10">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-950 text-brand-600 dark:text-brand-400 text-xs font-semibold border border-brand-200 dark:border-brand-800">
            <FileCheck className="w-3.5 h-3.5" />
            <span>Format Support Matrix</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-surface-900 dark:text-white">
            Supported Image Formats
          </h1>
          <p className="text-base text-surface-600 dark:text-surface-400 max-w-xl mx-auto">
            CleanShot supports all major raster, vector, modern, and camera RAW formats with dedicated lossless segment strippers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {formats.map((fmt) => (
            <div
              key={fmt.name}
              className="p-6 rounded-2xl bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-800 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-surface-900 dark:text-white">
                  {fmt.name}
                </h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
                  {fmt.ext}
                </span>
              </div>

              <div className="text-xs text-surface-600 dark:text-surface-400 space-y-1.5">
                <p>
                  <strong className="text-surface-900 dark:text-surface-200">Engine Method:</strong> {fmt.method}
                </p>
                <p>
                  <strong className="text-surface-900 dark:text-surface-200">Metadata Stripped:</strong> {fmt.tagsStripped}
                </p>
              </div>

              <div className="pt-2 border-t border-surface-100 dark:border-surface-800/80 flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{fmt.guarantee}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
