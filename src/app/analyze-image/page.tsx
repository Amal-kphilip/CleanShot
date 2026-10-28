'use client';

import React, { useEffect, useRef, useState } from 'react';
import * as exifr from 'exifr';
import {
  Activity,
  Image as ImageIcon,
  MapPin,
  Ruler,
  ShieldAlert,
} from 'lucide-react';
import { ToolShell } from '@/components/tools/ToolShell';

type ImageReport = {
  name: string;
  size: number;
  type: string;
  width: number;
  height: number;
  ratio: string;
  megapixels: string;
  averageBrightness: number;
  transparentPercent: string;
  colorsSampled: number;
  metadata: [string, string][];
  gpsPresent: boolean;
};

const MAX_SIZE = 50 * 1024 * 1024;
const formatSize = (size: number) =>
  size < 1024 * 1024
    ? `${(size / 1024).toFixed(1)} KB`
    : `${(size / 1024 / 1024).toFixed(2)} MB`;

export default function AnalyzeImagePage() {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImageReport | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const oldUrl = useRef('');

  useEffect(
    () => () => {
      if (oldUrl.current) URL.revokeObjectURL(oldUrl.current);
    },
    []
  );

  const analyze = async (selected?: File) => {
    setError('');
    setReport(null);
    setFile(null);
    if (!selected) return;
    if (selected.size > MAX_SIZE) {
      setError('Choose an image smaller than 50 MB.');
      return;
    }
    if (!selected.type.startsWith('image/')) {
      setError('Choose a browser-supported image file.');
      return;
    }
    if (oldUrl.current) URL.revokeObjectURL(oldUrl.current);
    const url = URL.createObjectURL(selected);
    oldUrl.current = url;
    setPreviewUrl(url);
    setFile(selected);
    setBusy(true);
    try {
      const image = await createImageBitmap(selected);
      const naturalWidth = image.width;
      const naturalHeight = image.height;
      const scale = Math.min(1, 320 / Math.max(naturalWidth, naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(naturalHeight * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context)
        throw new Error('Your browser does not support image analysis.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let brightness = 0,
        transparent = 0,
        samples = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        brightness +=
          (pixels[i] * 0.2126 +
            pixels[i + 1] * 0.7152 +
            pixels[i + 2] * 0.0722) /
          255;
        if (pixels[i + 3] < 250) transparent++;
        samples++;
      }
      image.close();
      let metadata: [string, string][] = [];
      let gpsPresent = false;
      try {
        const exif = (await exifr.parse(selected, true)) as
          | Record<string, unknown>
          | undefined;
        if (exif) {
          gpsPresent =
            Number.isFinite(exif.latitude) && Number.isFinite(exif.longitude);
          metadata = Object.entries(exif)
            .filter(
              ([, value]) =>
                value !== undefined &&
                value !== null &&
                typeof value !== 'object'
            )
            .slice(0, 80)
            .map(([key, value]) => [
              key,
              typeof value === 'number'
                ? String(Number(value.toFixed(5)))
                : String(value).slice(0, 220),
            ]);
        }
      } catch {
        /* no readable EXIF is a normal case */
      }
      setReport({
        name: selected.name,
        size: selected.size,
        type: selected.type || 'Unknown MIME type',
        width: naturalWidth,
        height: naturalHeight,
        ratio: (naturalWidth / naturalHeight).toFixed(3),
        megapixels: ((naturalWidth * naturalHeight) / 1_000_000).toFixed(2),
        averageBrightness: Math.round(
          (brightness / Math.max(samples, 1)) * 100
        ),
        transparentPercent: (
          (transparent / Math.max(samples, 1)) *
          100
        ).toFixed(2),
        colorsSampled: samples,
        metadata,
        gpsPresent,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Image analysis failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const downloadJson = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.name.replace(/\.[^.]+$/, '')}-analysis.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <ToolShell
      title="Image analysis."
      description="Measure technical image properties and inspect readable metadata locally in your browser."
    >
      <div className="grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-[4px] border-2 border-foreground bg-background p-5 sm:p-6">
          <label className="flex cursor-pointer flex-col items-center rounded-[4px] border-2 border-dashed border-foreground px-4 py-8 text-center transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Selected image preview"
                className="mb-4 max-h-56 max-w-full object-contain"
              />
            ) : (
              <ImageIcon className="mb-3 h-7 w-7 text-foreground" />
            )}
            <span className="text-[14px] font-semibold text-foreground">
              {file ? file.name : 'Choose an image'}
            </span>
            <span className="mt-1 text-[11px] text-text-sec">
              PNG, JPEG, WebP, GIF · 50 MB max
            </span>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => void analyze(event.target.files?.[0])}
            />
          </label>
          {busy && (
            <p role="status" className="mt-4 text-xs text-text-sec">
              Analyzing local pixels and readable metadata…
            </p>
          )}
          {error && (
            <p
              role="alert"
              className="mt-4 rounded-[4px] border-2 border-red-500 bg-red-500/10 p-3 text-xs text-foreground"
            >
              {error}
            </p>
          )}
          {report?.gpsPresent && (
            <div className="mt-4 flex gap-2 rounded-[4px] border-2 border-amber-500 bg-amber-500/10 p-3 text-xs leading-5 text-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              GPS coordinates were found in readable metadata. Review before
              sharing.
            </div>
          )}
          <button
            type="button"
            onClick={downloadJson}
            disabled={!report}
            className="mt-4 w-full px-4 py-2.5 rounded-[4px] border-2 border-foreground bg-background hover:bg-black/5 dark:hover:bg-white/10 text-foreground text-[12px] font-semibold disabled:opacity-40"
          >
            Export analysis JSON
          </button>
        </section>

        {report ? (
          <section className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['Dimensions', `${report.width} × ${report.height}`],
                ['Megapixels', report.megapixels],
                ['Aspect ratio', report.ratio],
                ['File size', formatSize(report.size)],
                ['Mean brightness', `${report.averageBrightness}%`],
                ['Transparent pixels', `${report.transparentPercent}%`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-[4px] border-2 border-foreground bg-background p-4"
                >
                  <p className="text-[11px] font-medium text-text-sec">{label}</p>
                  <p className="mt-1.5 break-words text-[18px] font-semibold tabular-nums text-foreground">
                    {value}
                  </p>
                </div>
              ))}
            </div>
            <div className="rounded-[4px] border-2 border-foreground bg-background p-5">
              <div className="mb-4 flex items-center gap-2">
                <Ruler className="h-4 w-4 text-foreground" />
                <h2 className="text-sm font-semibold text-foreground">
                  File properties
                </h2>
              </div>
              <div className="grid gap-3 text-xs sm:grid-cols-2">
                <p className="break-all text-text-sec">
                  Filename{' '}
                  <span className="block mt-1 font-medium text-foreground">
                    {report.name}
                  </span>
                </p>
                <p className="break-all text-text-sec">
                  MIME{' '}
                  <span className="block mt-1 font-medium text-foreground">
                    {report.type}
                  </span>
                </p>
                <p className="text-text-sec">
                  Pixels sampled{' '}
                  <span className="block mt-1 font-medium text-foreground">
                    {report.colorsSampled.toLocaleString()}
                  </span>
                </p>
                <p className="text-text-sec">
                  Readable metadata fields{' '}
                  <span className="block mt-1 font-medium text-foreground">
                    {report.metadata.length}
                  </span>
                </p>
              </div>
            </div>
            <div className="rounded-[4px] border-2 border-foreground bg-background p-5">
              <div className="mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-foreground" />
                <h2 className="text-sm font-semibold text-foreground">
                  Metadata tags
                </h2>
              </div>
              {report.metadata.length ? (
                <div className="max-h-80 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <tbody>
                      {report.metadata.map(([key, value]) => (
                        <tr className="border-t border-border-subtle" key={key}>
                          <th className="w-2/5 py-2 pr-3 align-top font-medium text-text-sec">
                            {key}
                          </th>
                          <td className="break-all py-2 text-foreground">
                            {value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-text-sec">
                  No EXIF/IPTC/XMP tags were returned by the metadata parser.
                </p>
              )}
            </div>
          </section>
        ) : (
          <section className="flex min-h-64 items-center justify-center rounded-[4px] border-2 border-dashed border-foreground bg-background p-8 text-center">
            <div>
              <ShieldAlert className="mx-auto h-6 w-6 text-text-sec" />
              <p className="mt-3 text-sm font-semibold text-foreground">
                Report appears here
              </p>
              <p className="mt-1 max-w-sm text-xs leading-5 text-text-sec">
                Choose an image to inspect pixels, dimensions, transparency, and
                readable metadata.
              </p>
            </div>
          </section>
        )}
      </div>
    </ToolShell>
  );
}
