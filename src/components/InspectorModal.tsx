'use client';

import React, { useState } from 'react';
import {
  X,
  MapPin,
  Camera,
  Calendar,
  Code,
  User,
  Sliders,
  AlertTriangle,
  Search,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { ParsedMetadata, MetadataField, MetadataCategory } from '@/lib/engine/types';

interface InspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata?: ParsedMetadata;
  filename: string;
  thumbnailUrl?: string;
}

export function InspectorModal({
  isOpen,
  onClose,
  metadata,
  filename,
  thumbnailUrl,
}: InspectorModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'before' | 'after'>('before');

  if (!isOpen || !metadata) return null;

  const filteredFields = metadata.fields.filter((field) => {
    const matchesCat = selectedCategory === 'all' || field.category === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      field.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      String(field.value).toLowerCase().includes(searchQuery.toLowerCase()) ||
      (field.description && field.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const categories = [
    { id: 'all', label: 'All Fields', count: metadata.fields.length, icon: Layers },
    { id: 'location', label: 'Location / GPS', count: metadata.categories.location, icon: MapPin },
    { id: 'camera', label: 'Camera & Lens', count: metadata.categories.camera, icon: Camera },
    { id: 'datetime', label: 'Date & Time', count: metadata.categories.datetime, icon: Calendar },
    { id: 'author', label: 'Author & Owner', count: metadata.categories.author, icon: User },
    { id: 'software', label: 'Software & Tech', count: metadata.categories.software, icon: Code },
    { id: 'technical', label: 'Image Specs', count: metadata.categories.technical, icon: Sliders },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white dark:bg-surface-900 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {thumbnailUrl && (
              <img
                src={thumbnailUrl}
                alt={filename}
                className="w-10 h-10 rounded-lg object-cover border border-surface-200 dark:border-surface-800 shadow-sm"
              />
            )}
            <div>
              <h3 className="text-base font-semibold text-surface-900 dark:text-white truncate max-w-md">
                {filename}
              </h3>
              <p className="text-xs text-surface-500 dark:text-surface-400 flex items-center gap-2">
                <span>Format: {metadata.format.toUpperCase()}</span>
                <span>&bull;</span>
                <span>{metadata.fields.length} Metadata Fields Detected</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-600 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* View Mode Switcher (Before vs After) */}
        <div className="px-6 py-2.5 bg-surface-50 dark:bg-surface-950 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between">
          <div className="flex items-center gap-2 bg-surface-200 dark:bg-surface-800/80 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('before')}
              className={`px-3.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'before'
                  ? 'bg-white dark:bg-surface-900 text-surface-900 dark:text-white shadow-sm'
                  : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
              }`}
            >
              Original File (With Metadata)
            </button>
            <button
              onClick={() => setActiveTab('after')}
              className={`px-3.5 py-1 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'after'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white'
              }`}
            >
              Cleaned File (Lossless Stripped)
            </button>
          </div>

          {metadata.hasHighRiskFields && (
            <div className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
              <ShieldAlert className="w-3.5 h-3.5" />
              High-Risk Privacy Leaks Found
            </div>
          )}
        </div>

        {/* Main Content */}
        {activeTab === 'after' ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-4 my-auto">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1 max-w-md">
              <h4 className="text-lg font-bold text-surface-900 dark:text-white">
                All {metadata.fields.length} Metadata Tags Stripped
              </h4>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                GPS coordinates, device serials, capture timestamps, and software signatures are completely wiped from the byte stream.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-800 text-xs font-medium text-surface-700 dark:text-surface-300 border border-surface-200 dark:border-surface-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Pixel-identical guarantee: 0 bitstream DCT/pixel data recompressed
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col md:flex-row min-h-0">
            {/* Category Sidebar */}
            <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-surface-200 dark:border-surface-800 p-3 space-y-1 shrink-0 overflow-x-auto md:overflow-y-auto">
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-brand-50 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300 font-semibold'
                        : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="w-3.5 h-3.5" />
                      <span>{cat.label}</span>
                    </div>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        isSelected
                          ? 'bg-brand-200/60 dark:bg-brand-900 text-brand-800 dark:text-brand-200'
                          : 'bg-surface-100 dark:bg-surface-800 text-surface-500'
                      }`}
                    >
                      {cat.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Fields List & GPS Preview */}
            <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4 overflow-y-auto">
              {/* GPS Privacy Preview Warning */}
              {metadata.gps && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        Exact GPS Location Exposed
                      </span>
                    </div>
                    {metadata.gps.mapUrl && (
                      <a
                        href={metadata.gps.mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-medium text-amber-800 dark:text-amber-300 hover:underline flex items-center gap-1"
                      >
                        View Map <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    This photo contains geo-coordinates: <code className="font-mono">{metadata.gps.latitude.toFixed(6)}, {metadata.gps.longitude.toFixed(6)}</code>
                    {metadata.gps.altitude ? ` (Altitude: ${metadata.gps.altitude.toFixed(1)}m)` : ''}.
                    Anyone with this file can pinpoint where it was photographed.
                  </p>
                </div>
              )}

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-surface-400" />
                <input
                  type="text"
                  placeholder="Search metadata fields or values..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Table of Fields */}
              <div className="border border-surface-200 dark:border-surface-800 rounded-xl overflow-hidden divide-y divide-surface-200 dark:divide-surface-800">
                {filteredFields.length === 0 ? (
                  <div className="p-8 text-center text-xs text-surface-400">
                    No metadata fields found matching query.
                  </div>
                ) : (
                  filteredFields.map((field) => (
                    <div
                      key={field.id}
                      className="p-3 hover:bg-surface-50 dark:hover:bg-surface-800/40 transition-colors flex items-start justify-between gap-4"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-surface-900 dark:text-surface-100">
                            {field.name}
                          </span>
                          {field.riskLevel === 'high' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center gap-1">
                              <AlertTriangle className="w-2.5 h-2.5" /> High Risk
                            </span>
                          )}
                        </div>
                        {field.description && (
                          <p className="text-[11px] text-surface-500 dark:text-surface-400">
                            {field.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-medium text-surface-800 dark:text-surface-200 break-all select-all">
                          {field.formattedValue || String(field.value)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3 bg-surface-50 dark:bg-surface-950 border-t border-surface-200 dark:border-surface-800 flex items-center justify-between">
          <span className="text-xs text-surface-500 dark:text-surface-400">
            {metadata.fields.length} total fields inspected
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg bg-surface-200 dark:bg-surface-800 hover:bg-surface-300 dark:hover:bg-surface-700 text-surface-800 dark:text-surface-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
