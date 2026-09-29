'use client';

import React from 'react';
import { ShieldCheck, Sparkles, MapPin, Camera, Calendar, HardDrive, CheckCircle2 } from 'lucide-react';
import { FileItemState } from './FileList';

interface SummaryCardProps {
  files: FileItemState[];
}

export function SummaryCard({ files }: SummaryCardProps) {
  const completedFiles = files.filter((f) => f.status === 'completed');
  if (completedFiles.length === 0) return null;

  let totalFieldsRemoved = 0;
  let totalBytesSaved = 0;
  let gpsCount = 0;
  let serialCount = 0;

  for (const f of completedFiles) {
    if (f.result) {
      totalFieldsRemoved += f.result.removedFieldsCount || (f.metadata?.fields.length ?? 0);
      totalBytesSaved += f.result.bytesSaved;
    }
    if (f.metadata?.gps) gpsCount++;
    if (f.metadata?.categories.camera) serialCount++;
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full p-6 rounded-3xl bg-gradient-to-br from-brand-600 via-indigo-600 to-brand-700 text-white shadow-xl shadow-brand-500/20 space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-lg font-bold">
              Privacy Secured &bull; {completedFiles.length} Cleaned {completedFiles.length === 1 ? 'Photo' : 'Photos'}
            </h4>
            <p className="text-xs text-brand-100 flex items-center gap-1.5">
              <span>0 bytes of image pixel data re-compressed</span>
              <span>&bull;</span>
              <span>100% Lossless Guarantee</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3.5 py-1.5 rounded-xl bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>Pixel-Identical</span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        <div className="p-3 rounded-xl bg-black/15 backdrop-blur-sm border border-white/10">
          <span className="text-[11px] font-medium text-brand-200 uppercase tracking-wider block">
            Fields Removed
          </span>
          <span className="text-xl font-extrabold">{totalFieldsRemoved || 'All EXIF'}</span>
        </div>

        <div className="p-3 rounded-xl bg-black/15 backdrop-blur-sm border border-white/10">
          <span className="text-[11px] font-medium text-brand-200 uppercase tracking-wider block">
            Header Space Saved
          </span>
          <span className="text-xl font-extrabold">{formatBytes(totalBytesSaved)}</span>
        </div>

        <div className="p-3 rounded-xl bg-black/15 backdrop-blur-sm border border-white/10">
          <span className="text-[11px] font-medium text-brand-200 uppercase tracking-wider block">
            GPS Leaks Wiped
          </span>
          <span className="text-xl font-extrabold">{gpsCount} Files</span>
        </div>

        <div className="p-3 rounded-xl bg-black/15 backdrop-blur-sm border border-white/10">
          <span className="text-[11px] font-medium text-brand-200 uppercase tracking-wider block">
            Camera Serials
          </span>
          <span className="text-xl font-extrabold">{serialCount} Stripped</span>
        </div>
      </div>
    </div>
  );
}
