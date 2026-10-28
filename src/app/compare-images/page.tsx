'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Download,
  Images,
  LoaderCircle,
  Upload,
} from 'lucide-react';
import { ToolShell } from '@/components/tools/ToolShell';
import {
  getComparisonCanvasSize,
  getContainedRect,
} from '@/lib/tools/imageComparison';

type Picked = { file: File; url: string; width: number; height: number };
type DiffResult = {
  url: string;
  width: number;
  height: number;
  changedPercent: number;
  meanDifference: number;
};

const MAX_FILE = 50 * 1024 * 1024;
const MAX_CANVAS_DIMENSION = 1200;
const CHANGED_PIXEL_THRESHOLD = 24;
const CANVAS_BACKGROUND = '#111';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(
        new Error('The selected image could not be decoded by this browser.')
      );
    image.src = url;
  });
}

function fmt(size: number) {
  return size < 1024 * 1024
    ? `${(size / 1024).toFixed(1)} KB`
    : `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function drawContained(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number
) {
  context.fillStyle = CANVAS_BACKGROUND;
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  const rect = getContainedRect(
    image.naturalWidth,
    image.naturalHeight,
    canvasWidth,
    canvasHeight
  );

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
}

export default function CompareImagesPage() {
  const [left, setLeft] = useState<Picked | null>(null);
  const [right, setRight] = useState<Picked | null>(null);
  const [split, setSplit] = useState(50);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const urls = useRef(new Set<string>());

  useEffect(() => () => urls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const select = async (which: 'left' | 'right', file?: File) => {
    setError('');
    if (diff) {
      URL.revokeObjectURL(diff.url);
      urls.current.delete(diff.url);
    }
    setDiff(null);
    if (!file) return;
    if (file.size > MAX_FILE) {
      setError(`${file.name} exceeds the 50 MB limit.`);
      return;
    }
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file supported by your browser.');
      return;
    }

    const url = URL.createObjectURL(file);
    urls.current.add(url);
    try {
      const image = await loadImage(url);
      const picked = {
        file,
        url,
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
      const old = which === 'left' ? left : right;
      if (old) {
        URL.revokeObjectURL(old.url);
        urls.current.delete(old.url);
      }
      if (which === 'left') setLeft(picked);
      else setRight(picked);
    } catch (caught) {
      URL.revokeObjectURL(url);
      urls.current.delete(url);
      setError(
        caught instanceof Error
          ? caught.message
          : 'Could not read the selected image.'
      );
    }
  };

  const compare = async () => {
    if (!left || !right) return;
    setBusy(true);
    setError('');

    try {
      const [imageA, imageB] = await Promise.all([
        loadImage(left.url),
        loadImage(right.url),
      ]);
      const { width, height } = getComparisonCanvasSize(
        { width: imageA.naturalWidth, height: imageA.naturalHeight },
        { width: imageB.naturalWidth, height: imageB.naturalHeight },
        MAX_CANVAS_DIMENSION
      );
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context)
        throw new Error(
          'Canvas pixel comparison is unavailable in this browser.'
        );

      drawContained(context, imageA, width, height);
      const pixelsA = context.getImageData(0, 0, width, height);
      drawContained(context, imageB, width, height);
      const pixelsB = context.getImageData(0, 0, width, height);

      const heat = context.createImageData(width, height);
      const pixelCount = width * height;
      let changedPixels = 0;
      let totalDelta = 0;

      for (let i = 0; i < pixelsA.data.length; i += 4) {
        const delta =
          (Math.abs(pixelsA.data[i] - pixelsB.data[i]) +
            Math.abs(pixelsA.data[i + 1] - pixelsB.data[i + 1]) +
            Math.abs(pixelsA.data[i + 2] - pixelsB.data[i + 2])) /
          3;

        totalDelta += delta;
        if (delta > CHANGED_PIXEL_THRESHOLD) changedPixels++;

        let red: number;
        let green: number;
        let blue: number;
        if (delta <= 128) {
          const t = delta / 128;
          red = 35 + (245 - 35) * t;
          green = 150 + (220 - 150) * t;
          blue = 45 + (40 - 45) * t;
        } else {
          const t = (delta - 128) / 127;
          red = 245 + (230 - 245) * t;
          green = 220 + (55 - 220) * t;
          blue = 40 + (35 - 40) * t;
        }
        heat.data[i] = Math.round(red);
        heat.data[i + 1] = Math.round(green);
        heat.data[i + 2] = Math.round(blue);
        heat.data[i + 3] = 255;
      }

      context.putImageData(heat, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (result) =>
            result
              ? resolve(result)
              : reject(new Error('Could not create the heatmap image.')),
          'image/png'
        );
      });

      const url = URL.createObjectURL(blob);
      urls.current.add(url);
      setDiff({
        url,
        width,
        height,
        changedPercent: pixelCount ? (changedPixels / pixelCount) * 100 : 0,
        meanDifference: pixelCount ? totalDelta / pixelCount : 0,
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Image comparison failed.'
      );
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!diff) return;
    const anchor = document.createElement('a');
    anchor.href = diff.url;
    anchor.download = 'cleanshot-image-difference.png';
    anchor.click();
  };

  const clear = () => {
    if (left) {
      URL.revokeObjectURL(left.url);
      urls.current.delete(left.url);
    }
    if (right) {
      URL.revokeObjectURL(right.url);
      urls.current.delete(right.url);
    }
    if (diff) {
      URL.revokeObjectURL(diff.url);
      urls.current.delete(diff.url);
    }
    setLeft(null);
    setRight(null);
    setDiff(null);
    setError('');
    setSplit(50);
  };

  const FilePicker = ({
    side,
    item,
  }: {
    side: 'left' | 'right';
    item: Picked | null;
  }) => (
    <label className="flex min-w-0 cursor-pointer items-center gap-3 rounded-[4px] border-2 border-dashed border-foreground bg-background p-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] border-2 border-foreground text-foreground">
        <Upload className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-foreground">
          {side === 'left' ? 'Image A · Left' : 'Image B · Right'}
        </span>
        <span className="mt-1 block truncate text-[11px] text-text-sec">
          {item ? item.file.name : 'Select an image · max 50 MB'}
        </span>
      </span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={side === 'left' ? 'Select image A' : 'Select image B'}
        onChange={(event) => {
          void select(side, event.target.files?.[0]);
          event.currentTarget.value = '';
        }}
      />
    </label>
  );

  return (
    <ToolShell
      title="Compare images."
      description="Compare two local images side by side, reveal image A on the left and image B on the right, and generate a pixel-difference heatmap."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FilePicker side="left" item={left} />
        <FilePicker side="right" item={right} />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-[4px] border-2 border-red-500 bg-red-500/10 p-3 text-xs text-foreground"
        >
          {error}
        </p>
      )}

      {left && right ? (
        <>
          <div className="mt-5 rounded-[4px] border-2 border-foreground bg-background p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold text-foreground">
                Overlay comparison
              </p>
              <p className="text-xs text-text-sec">
                Image A on the left · Image B on the right
              </p>
            </div>

            <div className="relative mx-auto aspect-[4/3] max-h-[620px] overflow-hidden rounded-[4px] border-2 border-foreground bg-black sm:aspect-video">
              <img
                src={right.url}
                alt={`Image B on right: ${right.file.name}`}
                className="absolute inset-0 h-full w-full select-none object-contain"
                draggable={false}
              />
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
              >
                <img
                  src={left.url}
                  alt={`Image A on left: ${left.file.name}`}
                  className="absolute inset-0 h-full w-full select-none object-contain"
                  draggable={false}
                />
              </div>

              <div className="absolute bottom-3 left-3 rounded-[4px] border border-white/25 bg-black/80 px-2 py-1 text-[10px] font-semibold uppercase text-white">
                A · Left
              </div>
              <div className="absolute bottom-3 right-3 rounded-[4px] border border-white/25 bg-black/80 px-2 py-1 text-[10px] font-semibold uppercase text-white">
                B · Right
              </div>
              <div
                className="absolute bottom-0 top-0 w-0.5 bg-white"
                style={{ left: `${split}%` }}
              >
                <span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-black bg-white text-black">
                  <ArrowLeftRight size={14} />
                </span>
              </div>
            </div>

            <label className="mt-3 block">
              <span className="sr-only">Image A left-side reveal amount</span>
              <input
                aria-label="Image A left-side reveal amount"
                type="range"
                min={0}
                max={100}
                value={split}
                onChange={(event) => setSplit(Number(event.target.value))}
                className="mt-1 min-h-10 w-full accent-[var(--accent-primary)]"
              />
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-[4px] border border-border-subtle p-3">
                <p className="break-words text-xs font-semibold text-foreground">
                  A · {left.file.name}
                </p>
                <p className="mt-1 text-[11px] text-text-sec">
                  {left.width} × {left.height} px · {fmt(left.file.size)}
                </p>
              </div>
              <div className="min-w-0 rounded-[4px] border border-border-subtle p-3">
                <p className="break-words text-xs font-semibold text-foreground">
                  B · {right.file.name}
                </p>
                <p className="mt-1 text-[11px] text-text-sec">
                  {right.width} × {right.height} px · {fmt(right.file.size)}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                onClick={() => void compare()}
                disabled={busy}
                className="px-5 py-2.5 rounded-[4px] bg-foreground text-background hover:opacity-90 text-[13px] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Images className="h-4 w-4" />
                )}
                {busy ? 'Comparing…' : 'Generate pixel heatmap'}
              </button>
              <button
                type="button"
                onClick={clear}
                className="px-5 py-2.5 rounded-[4px] border-2 border-foreground bg-background hover:bg-black/5 dark:hover:bg-white/10 text-foreground text-[13px] font-semibold inline-flex items-center justify-center"
              >
                Clear files
              </button>
            </div>
          </div>

          {diff && (
            <section className="mt-5 rounded-[4px] border-2 border-foreground bg-background p-4 sm:p-5">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase text-text-sec">
                    Pixel diff report
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-foreground">
                    {diff.changedPercent.toFixed(2)}% changed pixels
                  </h2>
                  <p className="mt-2 max-w-xl text-xs leading-5 text-text-sec">
                    A pixel counts as changed when its mean RGB difference
                    exceeds {CHANGED_PIXEL_THRESHOLD}/255.
                  </p>
                </div>
                <button
                  type="button"
                  className="px-4 py-2 rounded-[4px] border-2 border-foreground bg-background hover:bg-black/5 dark:hover:bg-white/10 text-foreground text-[12px] font-semibold inline-flex items-center gap-2"
                  onClick={download}
                >
                  <Download className="h-4 w-4" /> Download heatmap
                </button>
              </div>

              <img
                src={diff.url}
                alt="Pixel difference heatmap"
                className="mt-5 max-h-[500px] w-full rounded-[4px] border border-border-subtle object-contain"
              />
              <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <p className="rounded-[4px] border border-border-subtle p-3 text-text-sec">
                  Normalized canvas{' '}
                  <span className="mt-1 block font-semibold text-foreground">
                    {diff.width} × {diff.height}
                  </span>
                </p>
                <p className="rounded-[4px] border border-border-subtle p-3 text-text-sec">
                  Mean RGB channel difference{' '}
                  <span className="mt-1 block font-semibold text-foreground">
                    {diff.meanDifference.toFixed(2)} / 255
                  </span>
                </p>
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="mt-5 flex min-h-64 items-center justify-center rounded-[4px] border-2 border-dashed border-foreground bg-background p-8 text-center">
          <div>
            <Images className="mx-auto h-7 w-7 text-text-sec" />
            <p className="mt-3 text-sm font-semibold text-foreground">
              Choose two images to compare
            </p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-text-sec">
              The overlay keeps A on the left and B on the right. Files stay in
              this tab.
            </p>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
