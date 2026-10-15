'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Download, Images, LoaderCircle, Upload } from 'lucide-react';
import { ToolShell } from '@/components/tools/ToolShell';

type Picked = { file: File; url: string; width: number; height: number };
type DiffResult = { url: string; width: number; height: number; changedPercent: number; meanDifference: number };
const MAX_FILE = 50 * 1024 * 1024;
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('The selected image could not be decoded by this browser.')); image.src = url; });
}
function fmt(size: number) { return size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(2)} MB`; }

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
    setError(''); setDiff((old) => { if (old) URL.revokeObjectURL(old.url); return null; });
    if (!file) return;
    if (file.size > MAX_FILE) { setError(`${file.name} exceeds the 50 MB limit.`); return; }
    if (!file.type.startsWith('image/')) { setError('Choose an image file supported by your browser.'); return; }
    const url = URL.createObjectURL(file); urls.current.add(url);
    try {
      const image = await loadImage(url);
      const picked = { file, url, width: image.naturalWidth, height: image.naturalHeight };
      const old = which === 'left' ? left : right;
      if (old) { URL.revokeObjectURL(old.url); urls.current.delete(old.url); }
      if (which === 'left') setLeft(picked); else setRight(picked);
    } catch (caught) {
      URL.revokeObjectURL(url); urls.current.delete(url);
      setError(caught instanceof Error ? caught.message : 'Could not read the selected image.');
    }
  };

  const compare = async () => {
    if (!left || !right) return;
    setBusy(true); setError('');
    try {
      const [a, b] = await Promise.all([loadImage(left.url), loadImage(right.url)]);
      const width = Math.min(1200, Math.max(a.naturalWidth, b.naturalWidth));
      const height = Math.min(1200, Math.max(a.naturalHeight, b.naturalHeight));
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Canvas pixel comparison is unavailable in this browser.');
      context.fillStyle = '#111'; context.fillRect(0, 0, width, height); context.drawImage(a, 0, 0, width, height);
      const first = context.getImageData(0, 0, width, height);
      context.fillStyle = '#111'; context.fillRect(0, 0, width, height); context.drawImage(b, 0, 0, width, height);
      const second = context.getImageData(0, 0, width, height);
      const heat = context.createImageData(width, height);
      const count = width * height; let changed = 0; let totalDelta = 0;
      for (let i = 0; i < first.data.length; i += 4) {
        const delta = (Math.abs(first.data[i] - second.data[i]) + Math.abs(first.data[i + 1] - second.data[i + 1]) + Math.abs(first.data[i + 2] - second.data[i + 2])) / 3;
        totalDelta += delta;
        if (delta > 24) changed++;
        heat.data[i] = Math.min(255, delta * 2.4 + 35);
        heat.data[i + 1] = Math.max(0, 90 - delta * .35);
        heat.data[i + 2] = Math.max(0, 35 - delta * .1);
        heat.data[i + 3] = 255;
      }
      context.putImageData(heat, 0, 0);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Could not create the heatmap image.')), 'image/png'));
      const url = URL.createObjectURL(blob); urls.current.add(url);
      setDiff({ url, width, height, changedPercent: count ? changed / count * 100 : 0, meanDifference: count ? totalDelta / count : 0 });
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Image comparison failed.'); }
    finally { setBusy(false); }
  };
  const download = () => { if (!diff) return; const a = document.createElement('a'); a.href = diff.url; a.download = 'stripmeta-image-difference.png'; a.click(); };
  const clear = () => {
    if (left) { URL.revokeObjectURL(left.url); urls.current.delete(left.url); }
    if (right) { URL.revokeObjectURL(right.url); urls.current.delete(right.url); }
    if (diff) { URL.revokeObjectURL(diff.url); urls.current.delete(diff.url); }
    setLeft(null); setRight(null); setDiff(null); setError(''); setSplit(50);
  };

  const FilePicker = ({ side, item }: { side: 'left' | 'right'; item: Picked | null }) => <label className="flex min-w-0 cursor-pointer items-center gap-3 border border-dashed border-white/20 bg-black/25 p-3 transition-colors hover:border-lime-300/50"><span className="flex h-9 w-9 shrink-0 items-center justify-center border border-lime-300/20 text-lime-300"><Upload className="h-4 w-4"/></span><span className="min-w-0 flex-1"><span className="block text-xs font-semibold">{side === 'left' ? 'Original / A' : 'Edited / B'}</span><span className="mt-1 block truncate text-[10px] text-text-ter">{item ? item.file.name : 'Select an image · max 50 MB'}</span></span><input type="file" accept="image/*" className="sr-only" onChange={(event) => void select(side, event.target.files?.[0])}/></label>;

  return <ToolShell title="Compare" accent="images." description="Inspect two local images side by side, reveal one through the other, and generate a heatmap of pixel differences. Everything runs inside this browser tab.">
    <div className="grid gap-3 sm:grid-cols-2"><FilePicker side="left" item={left}/><FilePicker side="right" item={right}/></div>
    {error && <p role="alert" className="mt-4 border border-red-300/20 p-3 text-xs text-red-200">{error}</p>}
    {left && right ? <>
      <div className="mt-5 border border-border-subtle bg-black/40 p-3 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold">Overlay comparison</p><p className="text-[10px] text-text-ter">Drag the slider to reveal image B</p></div>
        <div className="relative mx-auto aspect-[4/3] max-h-[620px] overflow-hidden border border-white/10 bg-[#090a07]">
          <img src={left.url} alt={`Image A: ${left.file.name}`} className="absolute inset-0 h-full w-full select-none object-contain"/>
          <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}><img src={right.url} alt={`Image B: ${right.file.name}`} className="absolute inset-0 h-full w-full select-none object-contain"/></div>
          <div className="absolute bottom-3 left-3 border border-white/15 bg-black/80 px-2 py-1 text-[9px] font-bold uppercase tracking-[.13em]">A · Original</div>
          <div className="absolute bottom-3 right-3 border border-white/15 bg-black/80 px-2 py-1 text-[9px] font-bold uppercase tracking-[.13em]">B · Edited</div>
          <div className="absolute bottom-0 top-0 w-px bg-lime-300 shadow-[0_0_12px_rgba(200,245,54,.6)]" style={{ left: `${split}%` }}><span className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-black/40 bg-lime-300 text-black"><ArrowLeftRight size={15}/></span></div>
        </div>
        <input aria-label="Image overlay split" type="range" min={0} max={100} value={split} onChange={(event) => setSplit(Number(event.target.value))} className="mt-4 w-full accent-lime-300"/>
        <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="border border-border-subtle p-3"><p className="truncate text-xs font-semibold">{left.file.name}</p><p className="mt-1 text-[10px] text-text-ter">{left.width} × {left.height} px · {fmt(left.file.size)}</p></div><div className="border border-border-subtle p-3"><p className="truncate text-xs font-semibold">{right.file.name}</p><p className="mt-1 text-[10px] text-text-ter">{right.width} × {right.height} px · {fmt(right.file.size)}</p></div></div>
        <div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => void compare()} disabled={busy} className="primary-cta disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Images className="h-4 w-4"/>}{busy ? 'Comparing…' : 'Generate pixel heatmap'}</button><button type="button" onClick={clear} className="secondary-cta">Clear files</button></div>
      </div>
      {diff && <section className="mt-5 border border-border-subtle bg-white/[.02] p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="section-kicker">PIXEL DIFF REPORT</p><h2 className="display-serif mt-2 text-3xl">{diff.changedPercent.toFixed(2)}% changed pixels</h2><p className="mt-2 max-w-xl text-xs leading-5 text-text-ter">Images are resized to a common canvas before comparison. This is a visual estimate, not proof of file authenticity or AI origin. Antialiasing, compression, and resizing can affect the result.</p></div><button type="button" className="secondary-cta" onClick={download}><Download className="h-4 w-4"/> Download heatmap</button></div><img src={diff.url} alt="Generated image difference heatmap" className="mt-5 max-h-[500px] w-full border border-border-subtle object-contain"/><div className="mt-3 grid grid-cols-2 gap-3 text-xs"><p className="border border-border-subtle p-3 text-text-sec">Normalized canvas <span className="mt-1 block font-semibold text-foreground">{diff.width} × {diff.height}</span></p><p className="border border-border-subtle p-3 text-text-sec">Mean channel difference <span className="mt-1 block font-semibold text-foreground">{diff.meanDifference.toFixed(2)} / 255</span></p></div></section>}
    </> : <div className="mt-5 flex min-h-64 items-center justify-center border border-border-subtle bg-white/[.015] p-8 text-center"><div><Images className="mx-auto h-8 w-8 text-text-ter"/><p className="mt-3 text-sm font-semibold">Choose two images to compare</p><p className="mt-1 max-w-sm text-xs leading-5 text-text-ter">Overlay and normalized pixel heatmap comparison work with browser-decodable images. Files stay in this tab.</p></div></div>}
  </ToolShell>;
}
