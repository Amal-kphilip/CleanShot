export type ImageFormat =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'gif'
  | 'bmp'
  | 'tiff'
  | 'svg'
  | 'heic'
  | 'avif'
  | 'jxl'
  | 'raw'
  | 'pdf'
  | 'docx'
  | 'mp4'
  | 'mov'
  | 'm4a'
  | 'webm'
  | 'mkv'
  | 'mp3'
  | 'aac'
  | 'flac'
  | 'wav'
  | 'unknown';

export type RiskLevel = 'high' | 'medium' | 'low';

export type MetadataCategory =
  | 'location'
  | 'camera'
  | 'datetime'
  | 'software'
  | 'author'
  | 'technical'
  | 'other';

export interface MetadataField {
  id: string;
  name: string;
  category: MetadataCategory;
  value: string | number | boolean;
  formattedValue?: string;
  riskLevel: RiskLevel;
  description?: string;
}

export interface GpsLocation {
  latitude: number;
  longitude: number;
  altitude?: number;
  mapUrl?: string;
}

export interface ParsedMetadata {
  format: ImageFormat;
  mimeType: string;
  fileSize: number;
  width?: number;
  height?: number;
  fields: MetadataField[];
  gps?: GpsLocation;
  categories: {
    location: number;
    camera: number;
    datetime: number;
    software: number;
    author: number;
    technical: number;
    other: number;
  };
  hasHighRiskFields: boolean;
  rawSummary: Record<string, any>;
}

export interface StripOptions {
  keepIccProfile?: boolean;      // Opt in to preserving color-profile/rendering metadata (default: false; strict metadata removal)
  keepOrientation?: boolean;     // Opt in to retaining only EXIF orientation where supported (default: false; strict metadata removal)
  stripAll?: boolean;            // Strip all removable metadata in supported formats (default: true)
  removeGps?: boolean;           // GPS coordinates, altitude (default: true)
  removeCameraInfo?: boolean;    // Make, model, serial numbers (default: true)
  removeTimestamps?: boolean;    // Capture date/time (default: true)
  removeAuthorCopyright?: boolean; // Artist, copyright, creator (default: true)
  removeSoftwareTech?: boolean;  // Software, history, editing tools (default: true)
  removeThumbnails?: boolean;    // Embedded thumbnail images (default: true)
  filenameSuffix?: string;       // e.g. "_clean" or ""
  preserveFolderStructure?: boolean; // In ZIP output
}

export interface StripResult {
  filename: string;
  cleanedFilename: string;
  format: ImageFormat;
  originalSize: number;
  cleanedSize: number;
  bytesSaved: number;
  percentSaved: number;
  removedFieldsCount: number;
  removedSegments: string[];
  pixelIdentical: boolean;
  pixelHash?: string;
  cleanedBuffer: Uint8Array;
  mimeType: string;
  error?: string;
}

export interface BatchSummary {
  totalFiles: number;
  successCount: number;
  errorCount: number;
  totalOriginalBytes: number;
  totalCleanedBytes: number;
  totalBytesSaved: number;
  totalFieldsRemoved: number;
  durationMs: number;
}
