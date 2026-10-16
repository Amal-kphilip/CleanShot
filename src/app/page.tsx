'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Header } from '@/components/Header';
import { DropZone } from '@/components/DropZone';
import { FileList, FileItemState } from '@/components/FileList';
import { SummaryCard } from '@/components/SummaryCard';
import { ActionBar } from '@/components/ActionBar';
import { InspectorModal } from '@/components/InspectorModal';
import { SettingsModal } from '@/components/SettingsModal';
import { StripOptions, StripResult } from '@/lib/engine/types';
import { processBatchWithConcurrency, createThumbnail, inspectFileInWorker } from '@/lib/worker/workerRunner';
import { createZipArchive, triggerDownload } from '@/lib/zip/clientZip';
import {
  LockKeyhole, Cpu, Layers3, CheckCircle2, ArrowDownRight, ScanSearch,
  ShieldCheck, Sparkles, FileImage, Fingerprint, Download, ScanLine,
} from 'lucide-react';

const easeOut = [0.22, 1, 0.36, 1] as const;
const MAX_CLIENT_FILES = 150;
const MAX_CLIENT_FILE_BYTES = 50 * 1024 * 1024;
const MAX_CLIENT_BATCH_BYTES = 100 * 1024 * 1024;

export default function HomePage() {
  const [files, setFiles] = useState<FileItemState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isServerMode, setIsServerMode] = useState(false);
  const [batchError, setBatchError] = useState('');
  const [options, setOptions] = useState<StripOptions>({
    keepIccProfile: false,
    keepOrientation: false,
    stripAll: true,
    filenameSuffix: '_clean',
    preserveFolderStructure: false,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inspectItem, setInspectItem] = useState<FileItemState | null>(null);
  const objectUrls = useRef(new Set<string>());
  const reduceMotion = useReducedMotion();

  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
  }, []);

  const revokeThumbnail = (item: FileItemState) => {
    if (item.thumbnailUrl && objectUrls.current.has(item.thumbnailUrl)) {
      URL.revokeObjectURL(item.thumbnailUrl);
      objectUrls.current.delete(item.thumbnailUrl);
    }
  };

  const handleFilesSelected = useCallback(async (newFiles: File[]) => {
    if (isProcessing) return;
    setBatchError('');
    let queuedBytes = files.reduce((total, item) => total + item.file.size, 0);
    const acceptedFiles: File[] = [];
    const rejected: string[] = [];
    for (const file of newFiles) {
      if (file.size > MAX_CLIENT_FILE_BYTES) { rejected.push(`${file.name} (over 50 MB)`); continue; }
      if (files.length + acceptedFiles.length >= MAX_CLIENT_FILES) { rejected.push(`${file.name} (queue limit: ${MAX_CLIENT_FILES} files)`); continue; }
      if (queuedBytes + file.size > MAX_CLIENT_BATCH_BYTES) { rejected.push(`${file.name} (batch limit: 100 MB)`); continue; }
      acceptedFiles.push(file);
      queuedBytes += file.size;
    }
    if (rejected.length) setBatchError(`Some files were not added to protect browser memory. Limits: 50 MB per file, 100 MB total queue, and ${MAX_CLIENT_FILES} files. Rejected: ${rejected.slice(0, 4).join(', ')}${rejected.length > 4 ? `, and ${rejected.length - 4} more` : ''}.`);
    if (!acceptedFiles.length) return;
    const initialItems: FileItemState[] = acceptedFiles.map((file) => {
      const thumbnailUrl = createThumbnail(file);
      if (thumbnailUrl) objectUrls.current.add(thumbnailUrl);
      return {
        id: crypto.randomUUID(),
        file,
        relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        thumbnailUrl,
        status: 'queued',
        progress: 0,
        selected: true,
      };
    });
    setFiles((prev) => [...prev, ...initialItems]);

    // Inspect sequentially to avoid holding many full-size ArrayBuffers at once.
    for (const item of initialItems) {
      try {
        const meta = await inspectFileInWorker(item.file, item.id);
        setFiles((prev) => prev.map((file) => file.id === item.id ? { ...file, metadata: meta } : file));
      } catch {
        // Unsupported or malformed files remain queued and receive a precise error on processing.
      }
    }
  }, [files, isProcessing]);

  const handleProcessAll = useCallback(async () => {
    if (isProcessing) return;
    const queuedItems = files.filter((file) => file.selected !== false && (file.status === 'queued' || file.status === 'error'));
    if (!queuedItems.length) return;

    // Match the server API limits before sending any bytes over the network.
    if (isServerMode) {
      const serverOversized = queuedItems.find((item) => item.file.size > 20 * 1024 * 1024);
      const serverBatchBytes = queuedItems.reduce((total, item) => total + item.file.size, 0);
      if (queuedItems.length > 40) {
        setBatchError('Server-Side mode supports up to 40 files per batch. Deselect some files or use Client-Side mode.');
        return;
      }
      if (serverOversized) {
        setBatchError(`“${serverOversized.file.name}” exceeds the 20 MB per-file limit for Server-Side mode. Use Client-Side mode or remove this file from the batch.`);
        return;
      }
      if (serverBatchBytes > 50 * 1024 * 1024) {
        setBatchError('Server-Side mode is limited to 50 MB total per batch. Deselect some files or use Client-Side mode.');
        return;
      }
    }

    setBatchError('');
    setIsProcessing(true);
    const queuedIds = new Set(queuedItems.map((item) => item.id));
    try {
      if (!isServerMode) {
        const tasks = queuedItems.map((item) => ({
          id: item.id,
          file: item.file,
          relativePath: item.relativePath,
          options,
          metadata: item.metadata,
        }));
        await processBatchWithConcurrency(
          tasks,
          Math.min(3, Math.max(1, typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 2) - 1 : 2)),
          (id) => setFiles((prev) => prev.map((file) => file.id === id ? { ...file, status: 'processing', progress: 5, error: undefined } : file)),
          (output) => setFiles((prev) => prev.map((file) => file.id === output.id ? {
            ...file,
            status: output.result.error ? 'error' : 'completed',
            progress: output.result.error ? 0 : 100,
            result: output.result.error ? undefined : output.result,
            metadata: output.metadata || file.metadata,
            cleanedMetadata: output.result.error ? undefined : output.cleanedMetadata,
            serverJobId: undefined,
            serverFileId: undefined,
            error: output.result.error,
          } : file)),
          (id, error) => setFiles((prev) => prev.map((file) => file.id === id ? { ...file, status: 'error', error, progress: 0 } : file)),
          (id, progress) => setFiles((prev) => prev.map((file) => file.id === id ? { ...file, progress } : file)),
        );
      } else {
        setFiles((prev) => prev.map((file) => queuedIds.has(file.id)
          ? { ...file, status: 'processing', progress: 0, error: undefined }
          : file));
        const formData = new FormData();
        queuedItems.forEach((item) => formData.append('files', item.file, item.file.name));
        formData.append('clientIds', JSON.stringify(queuedItems.map((item) => item.id)));
        formData.append('options', JSON.stringify(options));

        const response = await fetch('/api/jobs', { method: 'POST', body: formData });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Server batch failed (${response.status}).`);
        if (typeof data.jobId !== 'string' || !Array.isArray(data.files)) {
          throw new Error('The server returned an invalid processing response.');
        }

        const serverFiles = new Map<string, { fileId?: string; filename: string; cleanedFilename: string; format: StripResult['format']; originalSize: number; cleanedSize: number; bytesSaved: number; removedFieldsCount: number; pixelIdentical: boolean; mimeType: string; error?: string; cleanedMetadata?: FileItemState['cleanedMetadata'] }>();
        for (const serverFile of data.files) {
          if (typeof serverFile.clientId === 'string') serverFiles.set(serverFile.clientId, serverFile);
        }
        setFiles((prev) => prev.map((file) => {
          if (!queuedIds.has(file.id)) return file;
          const match = serverFiles.get(file.id);
          if (!match) return { ...file, status: 'error', progress: 0, error: 'The server did not return a result for this file.' };
          const result: StripResult = {
            filename: match.filename,
            cleanedFilename: match.cleanedFilename,
            format: match.format,
            originalSize: match.originalSize,
            cleanedSize: match.cleanedSize,
            bytesSaved: match.bytesSaved,
            percentSaved: match.originalSize > 0 ? Number(((match.bytesSaved / match.originalSize) * 100).toFixed(2)) : 0,
            removedFieldsCount: match.removedFieldsCount,
            removedSegments: [],
            pixelIdentical: match.pixelIdentical,
            cleanedBuffer: new Uint8Array(),
            mimeType: match.mimeType || 'application/octet-stream',
            error: match.error,
          };
          return {
            ...file,
            status: match.error ? 'error' : 'completed',
            progress: match.error ? 0 : 100,
            error: match.error,
            result: match.error ? undefined : result,
            serverJobId: match.error ? undefined : data.jobId,
            serverFileId: match.error ? undefined : match.fileId,
            cleanedMetadata: match.error ? undefined : match.cleanedMetadata,
          };
        }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Processing failed. Please try again.';
      setBatchError(message);
      setFiles((prev) => prev.map((file) => queuedIds.has(file.id) && (file.status === 'queued' || file.status === 'processing')
        ? { ...file, status: 'error', error: message, progress: 0 }
        : file));
    } finally {
      setIsProcessing(false);
    }
  }, [files, options, isServerMode, isProcessing]);

  const fetchServerFile = async (item: FileItemState): Promise<Blob> => {
    if (!item.serverJobId || !item.serverFileId) throw new Error('This server result is missing its download reference.');
    const response = await fetch(`/api/jobs/${encodeURIComponent(item.serverJobId)}/files/${encodeURIComponent(item.serverFileId)}`);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Download failed (${response.status}).`);
    }
    return response.blob();
  };

  const handleDownloadSingle = async (item: FileItemState) => {
    if (!item.result || item.status !== 'completed') return;
    try {
      if (item.serverJobId && item.serverFileId) {
        const blob = await fetchServerFile(item);
        triggerDownload(blob, item.result.cleanedFilename);
        return;
      }
      if (!item.result.cleanedBuffer.length) throw new Error('No cleaned image data is available. Please process this file again.');
      const cleanedCopy = new Uint8Array(item.result.cleanedBuffer.byteLength);
      cleanedCopy.set(item.result.cleanedBuffer);
      triggerDownload(new Blob([cleanedCopy.buffer], { type: item.result.mimeType }), item.result.cleanedFilename);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not download the cleaned file.';
      setFiles((prev) => prev.map((file) => file.id === item.id ? { ...file, error: message } : file));
      setBatchError(message);
    }
  };

  const handleDownload = async () => {
    const readyFiles = files.filter((file) => file.selected !== false && file.status === 'completed' && file.result);
    if (!readyFiles.length) return;
    try {
      if (readyFiles.length === 1) {
        await handleDownloadSingle(readyFiles[0]);
        return;
      }
      const serverJobs = new Set(readyFiles.map((file) => file.serverJobId).filter(Boolean));
      const allServerFiles = readyFiles.every((file) => Boolean(file.serverJobId && file.serverFileId));
      if (allServerFiles && serverJobs.size === 1) {
        const jobId = readyFiles[0].serverJobId!;
        const fileIds = readyFiles.map((file) => file.serverFileId!).join(',');
        const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/zip?fileIds=${encodeURIComponent(fileIds)}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error || `ZIP download failed (${response.status}).`);
        }
        triggerDownload(await response.blob(), `cleanshot_cleaned_${Date.now()}.zip`);
        return;
      }
      const zipInputs = await Promise.all(readyFiles.map(async (file) => {
        const buffer = file.serverJobId ? new Uint8Array(await (await fetchServerFile(file)).arrayBuffer()) : file.result!.cleanedBuffer;
        if (!buffer.length) throw new Error(`${file.file.name} has no cleaned image data. Please process it again.`);
        return { name: file.result!.cleanedFilename, data: buffer, path: options.preserveFolderStructure ? file.relativePath : undefined };
      }));
      triggerDownload(createZipArchive(zipInputs, options.preserveFolderStructure), `cleanshot_cleaned_${Date.now()}.zip`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create the download.';
      setBatchError(message);
    }
  };

  const purgeServerJob = (jobId: string) => {
    void fetch(`/api/jobs/${encodeURIComponent(jobId)}`, { method: 'DELETE' }).catch(() => undefined);
  };

  const handleRemoveFile = (id: string) => {
    const item = files.find((file) => file.id === id);
    if (item) {
      revokeThumbnail(item);
      if (item.serverJobId) {
        const otherFilesFromJob = files.some((file) => file.id !== id && file.serverJobId === item.serverJobId);
        if (!otherFilesFromJob) purgeServerJob(item.serverJobId);
        else if (item.serverFileId) {
          void fetch(`/api/jobs/${encodeURIComponent(item.serverJobId)}/files/${encodeURIComponent(item.serverFileId)}`, { method: 'DELETE' }).catch(() => undefined);
        }
      }
    }
    setFiles((prev) => prev.filter((file) => file.id !== id));
    if (inspectItem?.id === id) setInspectItem(null);
  };

  const handleToggleSelect = (id: string) => setFiles((prev) => prev.map((file) => file.id === id ? { ...file, selected: file.selected === false } : file));

  const handleClearAll = () => {
    if (isProcessing) return;
    const jobIds = new Set(files.map((file) => file.serverJobId).filter((id): id is string => Boolean(id)));
    jobIds.forEach(purgeServerJob);
    files.forEach(revokeThumbnail);
    setFiles([]);
    setBatchError('');
    setInspectItem(null);
  };

  return (
    <div className="flex min-h-dvh flex-col site-shell">
      <Header onOpenSettings={() => setIsSettingsOpen(true)} />
      <main className="site-main flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8">
        <motion.section
          className="hero-section"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: easeOut }}
        >
          <div className="hero-kicker"><span className="status-dot" /> PRIVATE BY DESIGN <span className="kicker-divider" /> LOSSLESS WORKFLOW</div>
          <h1 className="hero-title display-serif">
            Your photos.<br />
            Your <span className="hero-accent">privacy.</span>
          </h1>
          <p className="hero-copy">Remove hidden metadata from your images without re-compressing the picture. Keep the image. Lose the personal trail.</p>
          <div className="hero-actions">
            <a href="#workspace" className="primary-cta">Clean your photos <ArrowDownRight size={16} /></a>
            <Link href="/how-it-works" className="secondary-cta">How it works <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="hero-proof" aria-label="Product highlights">
            <span><LockKeyhole size={14} /> Local processing by default</span>
            <span><ScanLine size={14} /> No re-encoding</span>
            <span><Layers3 size={14} /> Batch workflow</span>
          </div>

          <motion.div
            className="product-showcase"
            initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.14, ease: easeOut }}
          >
            <div className="showcase-topbar">
              <div className="window-dots"><i /><i /><i /></div>
              <span className="showcase-title">CLEANSHOT <span>/</span> PRIVACY WORKSPACE</span>
              <span className="showcase-mode"><span className="status-dot" /> {isServerMode ? 'SERVER MODE' : 'LOCAL MODE'}</span>
            </div>
            <div className="showcase-body">
              <div className="showcase-image-panel" aria-hidden="true">
                <div className="photo-sun" /><div className="photo-horizon" /><div className="photo-hill photo-hill-back" /><div className="photo-hill photo-hill-front" /><div className="photo-grain" />
                <span className="image-label">SAMPLE IMAGE · 04:32 PM</span>
              </div>
              <div className="showcase-inspector">
                <div className="inspector-heading"><div><span className="micro-label">FILE INSPECTOR</span><h2 className="display-serif">What your photo carries.</h2></div><ScanSearch size={19} /></div>
                <div className="metadata-row"><span className="metadata-icon"><Fingerprint size={15} /></span><span><b>Device identifiers</b><small>Camera &amp; device details</small></span><span className="removed-tag">REMOVED</span></div>
                <div className="metadata-row"><span className="metadata-icon"><LockKeyhole size={15} /></span><span><b>Location metadata</b><small>GPS coordinates &amp; altitude</small></span><span className="removed-tag">REMOVED</span></div>
                <div className="metadata-row"><span className="metadata-icon"><FileImage size={15} /></span><span><b>Image data</b><small>Encoded image stream</small></span><span className="kept-tag"><CheckCircle2 size={12} /> KEPT</span></div>
                <div className="showcase-foot"><ShieldCheck size={15} /><span>Designed to remove metadata without re-encoding supported formats.</span></div>
              </div>
            </div>
            <div className="showcase-bottom"><span><span className="lime-square" /> METADATA IN, PRIVACY OUT</span><span>NO ACCOUNT · NO TRACKING</span></div>
          </motion.div>
        </motion.section>

        <motion.div
          className="benefit-strip"
          initial={reduceMotion ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.6, ease: easeOut }}
        >
          <div><Cpu size={16} /><span>Lossless processing</span></div>
          <div><LockKeyhole size={16} /><span>Local-first privacy</span></div>
          <div><Layers3 size={16} /><span>Batch ready</span></div>
          <div><ScanSearch size={16} /><span>Metadata inspector</span></div>
          <div><Sparkles size={16} /><span>Clean, focused workflow</span></div>
        </motion.div>

        <motion.section
          id="workspace"
          className="workspace-section scroll-mt-28"
          initial={reduceMotion ? false : { opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.12 }}
          transition={{ duration: 0.65, ease: easeOut }}
        >
          <div className="section-heading-row">
            <div><span className="section-kicker">01 / THE WORKSPACE</span><h2 className="section-title display-serif">A cleaner image starts here.</h2><p className="section-copy">Drop your files in. Inspect what is embedded. Strip what you do not want to share.</p></div>
            <span className="section-index">01—03</span>
          </div>
          {batchError && <div role="alert" className="batch-error"><span>{batchError}</span><button type="button" onClick={() => setBatchError('')} aria-label="Dismiss error">×</button></div>}
          <div className="upload-frame">
            <DropZone onFilesSelected={handleFilesSelected} isProcessing={isProcessing} disabled={isProcessing} />
            <p className="privacy-note"><LockKeyhole size={13} /> Files stay in your browser in local mode. Server mode uploads files only when you explicitly enable it in Settings.</p>
          </div>
          <div className="queue-area">
            <SummaryCard files={files} />
            <FileList
              files={files}
              isProcessing={isProcessing}
              onRemoveFile={handleRemoveFile}
              onInspectFile={setInspectItem}
              onDownloadFile={handleDownloadSingle}
              onToggleSelect={handleToggleSelect}
              onProcessAll={handleProcessAll}
            />
          </div>
        </motion.section>

        {files.length === 0 && (
          <section className="features-section" aria-labelledby="features-heading">
            <motion.div className="section-heading-row feature-heading"
              initial={reduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: 0.6, ease: easeOut }}>
              <div><span className="section-kicker">02 / MADE FOR REAL WORK</span><h2 id="features-heading" className="section-title display-serif">Less noise. <span className="hero-accent">More control.</span></h2><p className="section-copy">A focused toolkit to understand what is inside your images and remove supported metadata before sharing.</p></div>
              <span className="section-index">02—03</span>
            </motion.div>
            <div className="feature-grid">
              <motion.article className="feature-card feature-card-large" initial={reduceMotion ? false : { opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.55, ease: easeOut }}>
                <div className="feature-icon"><Cpu size={19} /></div><span className="micro-label">LOSSLESS ENGINE</span><h3 className="display-serif">Keep the picture. Remove the extras.</h3><p>Supported formats are processed at the metadata/container level rather than being re-saved through a conventional photo editor.</p><div className="feature-visual feature-visual-lines"><i /><i /><i /><i /><i /><span>IMAGE STREAM <b>UNCHANGED</b></span></div>
              </motion.article>
              <motion.article className="feature-card" initial={reduceMotion ? false : { opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.55, delay: 0.08, ease: easeOut }}>
                <div className="feature-icon"><LockKeyhole size={19} /></div><span className="micro-label">LOCAL-FIRST</span><h3 className="display-serif">Privacy stays in your hands.</h3><p>Processing runs in your browser by default. Server processing is optional and clearly separated in Settings.</p><Link href="/privacy" className="text-link">Read the privacy approach ↗</Link>
              </motion.article>
              <motion.article className="feature-card" initial={reduceMotion ? false : { opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.55, delay: 0.16, ease: easeOut }}>
                <div className="feature-icon"><ScanSearch size={19} /></div><span className="micro-label">METADATA INSPECTOR</span><h3 className="display-serif">Know what is hidden.</h3><p>Review available GPS, camera, timestamp, software, and author fields before deciding what to remove.</p><Link href="/inspector" className="text-link">Open the inspector ↗</Link>
              </motion.article>
              <motion.article className="feature-card feature-card-wide" initial={reduceMotion ? false : { opacity: 0, y: 26 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: 0.55, delay: 0.08, ease: easeOut }}>
                <div><div className="feature-icon"><Layers3 size={19} /></div><span className="micro-label">BATCH WORKFLOW</span><h3 className="display-serif">A lot of files. One clear process.</h3><p>Queue images, inspect their metadata, track processing status, and download cleaned files together. Unsupported formats are reported instead of being passed off as clean.</p></div>
                <Link href="/formats" className="feature-cta">View supported formats <ArrowDownRight size={16} /></Link>
              </motion.article>
            </div>
          </section>
        )}
      </main>

      <footer className="site-footer"><div className="footer-inner"><Link href="/" className="footer-wordmark"><span className="brand-mark">C</span> CleanShot</Link><p>Photo privacy, handled with care.</p><div><Link href="/privacy">Privacy</Link><Link href="/formats">Formats</Link><Link href="/faq">FAQ</Link></div></div><p className="footer-bottom">Browser processing by default · Optional server mode is disclosed in Settings · No account required</p></footer>

      <ActionBar files={files} isProcessing={isProcessing} onDownload={handleDownload} onClearAll={handleClearAll} onProcessAll={handleProcessAll} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} options={options} onChangeOptions={setOptions} isServerMode={isServerMode} onToggleServerMode={setIsServerMode} />
      <InspectorModal isOpen={Boolean(inspectItem)} onClose={() => setInspectItem(null)} metadata={files.find((file) => file.id === inspectItem?.id)?.metadata || inspectItem?.metadata} cleanedMetadata={files.find((file) => file.id === inspectItem?.id)?.cleanedMetadata} isProcessed={files.some((file) => file.id === inspectItem?.id && file.status === 'completed')} processingError={files.find((file) => file.id === inspectItem?.id)?.error} filename={inspectItem?.file.name || ''} thumbnailUrl={files.find((file) => file.id === inspectItem?.id)?.thumbnailUrl || inspectItem?.thumbnailUrl} 
          file={inspectItem?.file}
        />
    </div>
  );
}
