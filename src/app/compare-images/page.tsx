'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Download, Images, LoaderCircle, Upload } from 'lucide-react';
import { ToolShell } from '@/components/tools/ToolShell';
import { getComparisonCanvasSize, getContainedRect } from '@/lib/tools/imageComparison';

type Picked = { file: File; url: string; width: number; height: number };
type DiffResult = { url: string; width: number; height: number; changedPercent: number; meanDifference: number };

const MAX_FILE = 50 * 1024 * 1024;
const MAX_CANVAS_DIMENSION = 1200;
const CHANGED_PIXEL_THRESHOLD = 24;
const CANVAS_BACKGROUND = '#111';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The selected image could not be decoded by this browser.'));
    image.src = url;
  });
}

function fmt(size: number) {
  return size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(2)} MB`;
}

/** Draw the full image, preserving its aspect ratio and centering it on the shared canvas. */
function drawContained(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  canvasWidth: number,
  canvasHeight: number,
) {
  context.fillStyle = CANVAS_BACKGROUND;
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  const rect = getContainedRect(image.naturalWidth, image.naturalHeight, canvasWidth, canvasHeight);

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
}

export default function CompareImagesPage() {
  const [left, setLeft] = useState<Picked | null>(null);
  const [right, setRight] = useState<Picked | null>(null);
  // `split` is the percentage of image A visible from the left edge.
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
      const picked = { file, url, width: image.naturalWidth, height: image.naturalHeight };
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
      setError(caught instanceof Error ? caught.message : 'Could not read the selected image.');
    }
  };

  const compare = async () => {
    if (!left || !right) return;
    setBusy(true);
    setError('');

    try {
      // Explicitly keep A and B in their selected order. Each is drawn into
      // the same aspect-ratio-preserving canvas before pixel comparison.
      const [imageA, imageB] = await Promise.all([loadImage(left.url), loadImage(right.url)]);
      const { width, height } = getComparisonCanvasSize(
        { width: imageA.naturalWidth, height: imageA.naturalHeight },
        { width: imageB.naturalWidth, height: imageB.naturalHeight },
        MAX_CANVAS_DIMENSION,
      );
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas pixel comparison is unavailable in this browser.');

      drawContained(context, imageA, width, height);
      const pixelsA = context.getImageData(0, 0, width, height);
      drawContained(context, imageB, width, height);
      const pixelsB = context.getImageData(0, 0, width, height);

      const heat = context.createImageData(width, height);
      const pixelCount = width * height;
      let changedPixels = 0;
      let totalDelta = 0;

      for (let i = 0; i < pixelsA.data.length; i += 4) {
        const delta = (
          Math.abs(pixelsA.data[i] - pixelsB.data[i]) +
          Math.abs(pixelsA.data[i + 1] - pixelsB.data[i + 1]) +
          Math.abs(pixelsA.data[i + 2] - pixelsB.data[i + 2])
        ) / 3;

        totalDelta += delta;
        if (delta > CHANGED_PIXEL_THRESHOLD) changedPixels++;

        // Low difference is green; increasing difference transitions through
        // yellow/orange to red. Alpha stays opaque for a portable PNG report.
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
          (result) => result ? resolve(result) : reject(new Error('Could not create the heatmap image.')),
          'image/png',
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
      setError(caught instanceof Error ? caught.message : 'Image comparison failed.');
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!diff) return;
    const anchor = document.createElement('a');
    anchor.href = diff.url;
    anchor.download = 'stripmeta-image-difference.png';
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

  const FilePicker = ({ side, item }: { side: 'left' | 'right'; item: Picked | null }) => (
    <label className="flex min-w-0 cursor-pointer items-center gap-3 border border-dashed border-white/20 bg-black/25 p-3 transition-colors hover:border-lime-300/50">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-lime-300/20 text-lime-300">
        <Upload className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold">{side === 'left' ? 'Image A · Left' : 'Image B · Right'}</span>
        <span className="mt-1 block truncate text-[11px] text-text-ter">{item ? item.file.name : 'Select an image · max 50 MB'}</span>
      </span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label={side === 'left' ? 'Select image A' : 'Select image B'}
        onChange={(event) => {
          void select(side, event.target.files?.[0]);
          // Allow selecting the same file again to replace/retry it.
          event.currentTarget.value = '';
        }}
      />
    </label>
  );

  return (
    <ToolShell
      title="Compare"
      accent="images."
      description="Compare two local images side by side, reveal image A on the left and image B on the right, and generate a pixel-difference heatmap. Everything runs inside this browser tab."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <FilePicker side="left" item={left} />
        <FilePicker side="right" item={right} />
      </div>

      {error && <p role="alert" className="mt-4 border border-red-300/20 p-3 text-xs text-red-200">{error}</p>}

      {left && right ? (
        <>
          <div className="mt-5 border border-border-subtle bg-black/40 p-3 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold">Overlay comparison</p>
              <p className="text-xs text-text-ter">Image A stays on the left · Image B stays on the right</p>
            </div>

            <div className="relative mx-auto aspect-[4/3] max-h-[620px] overflow-hidden border border-white/10 bg-[#090a07] sm:aspect-video">
              {/* B is the full base image. A is clipped to the left of the divider. */}
              <img
                src={right.url}
                alt={`Image B on right: ${right.file.name}`}
                className="absolute inset-0 h-full w-full select-none object-contain"
                draggable={false}
              />
              <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
                <img
                  src={left.url}
                  alt={`Image A on left: ${left.file.name}`}
                  className="absolute inset-0 h-full w-full select-none object-contain"
                  draggable={false}
                />
              </div>

              <div className="absolute bottom-3 left-3 border border-white/15 bg-black/85 px-2 py-1 text-[10px] font-bold uppercase tracking-[.13em]">A · Left</div>
              <div className="absolute bottom-3 right-3 border border-white/15 bg-black/85 px-2 py-1 text-[10px] font-bold uppercase tracking-[.13em]">B · Right</div>
              <div className="absolute bottom-0 top-0 w-px bg-lime-300 shadow-[0_0_12px_rgba(200,245,54,.6)]" style={{ left: `${split}%` }}>
                <span className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/40 bg-lime-300 text-black shadow-lg">
                  <ArrowLeftRight size={16} />
                </span>
              </div>
            </div>

            <label className="mt-3 block">
              <span className="sr-only">Image A left-side reveal amount</span>
              <input
                aria-label="Image A left-side reveal amount"
                aria-valuetext={`Image A visible on left: ${split} percent; Image B visible on right: ${100 - split} percent`}
                type="range"
                min={0}
                max={100}
                value={split}
                onChange={(event) => setSplit(Number(event.target.value))}
                className="mt-1 min-h-11 w-full touch-pan-y accent-lime-300"
              />
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 border border-border-subtle p-3">
                <p className="break-words text-xs font-semibold">A · {left.file.name}</p>
                <p className="mt-1 text-[11px] text-text-ter">{left.width} × {left.height} px · {fmt(left.file.size)}</p>
              </div>
              <div className="min-w-0 border border-border-subtle p-3">
                <p className="break-words text-xs font-semibold">B · {right.file.name}</p>
                <p className="mt-1 text-[11px] text-text-ter">{right.width} × {right.height} px · {fmt(right.file.size)}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <button type="button" onClick={() => void compare()} disabled={busy} className="primary-cta min-h-11 justify-center disabled:opacity-50">
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Images className="h-4 w-4" />}
                {busy ? 'Comparing…' : 'Generate pixel heatmap'}
              </button>
              <button type="button" onClick={clear} className="secondary-cta min-h-11 justify-center">Clear files</button>
            </div>
          </div>

          {diff && (
            <section className="mt-5 border border-border-subtle bg-white/[.02] p-4 sm:p-5">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
                <div className="min-w-0">
                  <p className="section-kicker">PIXEL DIFF REPORT</p>
                  <h2 className="display-serif mt-2 text-2xl sm:text-3xl">{diff.changedPercent.toFixed(2)}% changed pixels</h2>
                  <p className="mt-2 max-w-xl text-xs leading-5 text-text-ter">
                    Images are fitted proportionally and centered on a shared canvas; neither image is stretched or cropped. A pixel counts as changed when its mean RGB difference exceeds {CHANGED_PIXEL_THRESHOLD}/255. Resizing, alignment, transparency, compression, and real edits can affect the result. This is not an authenticity or AI-origin test.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-sec" aria-label="Heatmap colour legend">
                    <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#23834a]" aria-hidden="true"/>Lower difference</span>
                    <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#d95724]" aria-hidden="true"/>Higher difference</span>
                    <span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-[#e3b72c]" aria-hidden="true"/>Mid-range difference</span>
                  </div>
                </div>
                <button type="button" className="secondary-cta min-h-11 w-full justify-center sm:w-auto" onClick={download}>
                  <Download className="h-4 w-4" /> Download heatmap
                </button>
              </div>

              <img src={diff.url} alt="Pixel difference heatmap: green indicates lower differences and red indicates higher differences" className="mt-5 max-h-[500px] w-full border border-border-subtle object-contain" />
              <div className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                <p className="border border-border-subtle p-3 text-text-sec">Normalized canvas <span className="mt-1 block font-semibold text-foreground">{diff.width} × {diff.height}</span></p>
                <p className="border border-border-subtle p-3 text-text-sec">Mean RGB channel difference <span className="mt-1 block font-semibold text-foreground">{diff.meanDifference.toFixed(2)} / 255</span></p>
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="mt-5 flex min-h-64 items-center justify-center border border-border-subtle bg-white/[.015] p-8 text-center">
          <div>
            <Images className="mx-auto h-8 w-8 text-text-ter" />
            <p className="mt-3 text-sm font-semibold">Choose two images to compare</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-text-ter">The overlay keeps A on the left and B on the right. Heatmap comparison preserves aspect ratios and fits both images into a shared canvas. Files stay in this tab.</p>
          </div>
        </div>
      )}
    </ToolShell>
  );
}
