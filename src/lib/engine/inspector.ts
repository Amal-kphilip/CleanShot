import * as exifr from 'exifr';
import { ParsedMetadata, MetadataField, GpsLocation, ImageFormat } from './types';
import { detectImageFormat } from './magic';

/**
 * Metadata Inspector parser.
 * Extracts every discoverable metadata field, classifies into categories,
 * detects GPS location, and calculates privacy risk ratings.
 */
export async function inspectMetadata(buffer: Uint8Array): Promise<ParsedMetadata> {
  const formatInfo = detectImageFormat(buffer);
  const format = formatInfo.format;
  const fields: MetadataField[] = [];
  let gps: GpsLocation | undefined = undefined;
  let rawData: Record<string, any> = {};

  const categoriesCount = {
    location: 0,
    camera: 0,
    datetime: 0,
    software: 0,
    author: 0,
    technical: 0,
    other: 0,
  };

  let width: number | undefined;
  let height: number | undefined;

  try {
    // Parse comprehensive metadata with exifr
    const parsed = await exifr.parse(buffer, {
      tiff: true,
      xmp: true,
      icc: true,
      iptc: true,
      jfif: true,
      ihdr: true,
      gps: true,
      translateKeys: true,
      translateValues: true,
      reviveValues: true,
    });

    if (parsed) {
      rawData = parsed;
      width = parsed.ImageWidth || parsed.ExifImageWidth || parsed.width;
      height = parsed.ImageHeight || parsed.ExifImageHeight || parsed.height;

      // Extract GPS if available
      if (parsed.latitude !== undefined && parsed.longitude !== undefined) {
        gps = {
          latitude: Number(parsed.latitude),
          longitude: Number(parsed.longitude),
          altitude: parsed.GPSAltitude !== undefined ? Number(parsed.GPSAltitude) : undefined,
          mapUrl: `https://www.openstreetmap.org/?mlat=${parsed.latitude}&mlon=${parsed.longitude}#map=15/${parsed.latitude}/${parsed.longitude}`,
        };
      }

      // Categorize fields
      for (const [key, value] of Object.entries(parsed)) {
        if (value === undefined || value === null || typeof value === 'function') continue;
        // Skip raw nested objects or binary buffers in simple view
        if (value instanceof Uint8Array || value instanceof ArrayBuffer) continue;

        const stringVal = String(typeof value === 'object' ? JSON.stringify(value) : value);
        if (!stringVal || stringVal === '[object Object]') continue;

        const { category, riskLevel, description } = classifyTag(key, stringVal);

        categoriesCount[category]++;

        fields.push({
          id: key,
          name: formatTagName(key),
          category,
          value: stringVal,
          formattedValue: formatValue(key, value),
          riskLevel,
          description,
        });
      }
    }
  } catch (e) {
    // Fallback if format does not contain standard EXIF
  }

  // If PNG, check for PNG text chunks if none found
  if (format === 'png' && fields.length === 0) {
    extractPngTextChunks(buffer, fields, categoriesCount);
  }

  // If SVG, extract XML comments and metadata tags
  if (format === 'svg') {
    extractSvgMetadata(buffer, fields, categoriesCount);
  }

  const hasHighRiskFields = fields.some((f) => f.riskLevel === 'high');

  return {
    format,
    mimeType: formatInfo.mimeType,
    fileSize: buffer.length,
    width,
    height,
    fields,
    gps,
    categories: categoriesCount,
    hasHighRiskFields,
    rawSummary: rawData,
  };
}

function classifyTag(
  key: string,
  value: string
): {
  category: 'location' | 'camera' | 'datetime' | 'software' | 'author' | 'technical' | 'other';
  riskLevel: 'high' | 'medium' | 'low';
  description?: string;
} {
  const k = key.toLowerCase();

  // 1. Location (HIGH RISK)
  if (
    k.includes('gps') ||
    k.includes('latitude') ||
    k.includes('longitude') ||
    k.includes('altitude') ||
    k.includes('location') ||
    k.includes('city') ||
    k.includes('country') ||
    k.includes('destbearing')
  ) {
    return {
      category: 'location',
      riskLevel: 'high',
      description: 'Reveals exact geographic location where photo was captured',
    };
  }

  // 2. Author / Copyright / Owner (HIGH RISK)
  if (
    k.includes('artist') ||
    k.includes('author') ||
    k.includes('creator') ||
    k.includes('owner') ||
    k.includes('copyright') ||
    k.includes('credit') ||
    k.includes('byline') ||
    k.includes('contact')
  ) {
    return {
      category: 'author',
      riskLevel: 'high',
      description: 'Identifies the photographer, owner or personal identity',
    };
  }

  // 3. Serial Numbers & Identifiers (HIGH RISK)
  if (
    k.includes('serial') ||
    k.includes('bodyserial') ||
    k.includes('lensserial') ||
    k.includes('cameraid') ||
    k.includes('deviceid') ||
    k.includes('uniqueid')
  ) {
    return {
      category: 'camera',
      riskLevel: 'high',
      description: 'Unique device hardware serial number traceable across photos',
    };
  }

  // 4. Camera Hardware & Lens (MEDIUM / LOW RISK)
  if (
    k.includes('make') ||
    k.includes('model') ||
    k.includes('lens') ||
    k.includes('camera') ||
    k.includes('fnumber') ||
    k.includes('focallength') ||
    k.includes('iso') ||
    k.includes('exposure') ||
    k.includes('aperture') ||
    k.includes('flash') ||
    k.includes('shutter')
  ) {
    return {
      category: 'camera',
      riskLevel: 'medium',
      description: 'Camera gear and optical hardware shooting parameters',
    };
  }

  // 5. Date & Time (MEDIUM RISK)
  if (
    k.includes('date') ||
    k.includes('time') ||
    k.includes('subsectime') ||
    k.includes('offsettime') ||
    k.includes('timestamp')
  ) {
    return {
      category: 'datetime',
      riskLevel: 'medium',
      description: 'Exact timestamp when the file was captured or edited',
    };
  }

  // 6. Software & Editing History (MEDIUM / LOW RISK)
  if (
    k.includes('software') ||
    k.includes('processing') ||
    k.includes('hostcomputer') ||
    k.includes('history') ||
    k.includes('photoshop') ||
    k.includes('lightroom') ||
    k.includes('firmware')
  ) {
    return {
      category: 'software',
      riskLevel: 'medium',
      description: 'Editing software, OS environment, and processing history',
    };
  }

  // 7. Technical & Color Profile
  if (
    k.includes('colorspace') ||
    k.includes('profile') ||
    k.includes('icc') ||
    k.includes('width') ||
    k.includes('height') ||
    k.includes('bitspersample') ||
    k.includes('compression') ||
    k.includes('resolution')
  ) {
    return {
      category: 'technical',
      riskLevel: 'low',
      description: 'Image dimensions and color format characteristics',
    };
  }

  return {
    category: 'other',
    riskLevel: 'low',
  };
}

function formatTagName(key: string): string {
  // Convert camelCase or PascalCase to readable title
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function formatValue(key: string, val: any): string {
  if (val instanceof Date) {
    return val.toLocaleString();
  }
  if (typeof val === 'number') {
    if (key.toLowerCase().includes('exposuretime') && val > 0 && val < 1) {
      return `1/${Math.round(1 / val)}s`;
    }
    if (key.toLowerCase().includes('fnumber')) {
      return `ƒ/${val.toFixed(1)}`;
    }
    if (key.toLowerCase().includes('focallength')) {
      return `${val} mm`;
    }
    if (key.toLowerCase().includes('iso')) {
      return `ISO ${val}`;
    }
  }
  return String(val);
}

function extractPngTextChunks(
  buffer: Uint8Array,
  fields: MetadataField[],
  categoriesCount: Record<string, number>
) {
  let offset = 8;
  while (offset + 8 < buffer.length) {
    const len =
      (buffer[offset] << 24) |
      (buffer[offset + 1] << 16) |
      (buffer[offset + 2] << 8) |
      buffer[offset + 3];
    const type = String.fromCharCode(
      buffer[offset + 4],
      buffer[offset + 5],
      buffer[offset + 6],
      buffer[offset + 7]
    );

    if (type === 'tEXt' && len > 0 && offset + 8 + len <= buffer.length) {
      const data = buffer.slice(offset + 8, offset + 8 + len);
      const nullIdx = data.indexOf(0);
      if (nullIdx !== -1) {
        const key = new TextDecoder().decode(data.slice(0, nullIdx));
        const val = new TextDecoder().decode(data.slice(nullIdx + 1));
        const { category, riskLevel, description } = classifyTag(key, val);
        categoriesCount[category]++;
        fields.push({
          id: `png-${key}`,
          name: key,
          category,
          value: val,
          formattedValue: val,
          riskLevel,
          description,
        });
      }
    }
    offset += 12 + len;
  }
}

function extractSvgMetadata(
  buffer: Uint8Array,
  fields: MetadataField[],
  categoriesCount: Record<string, number>
) {
  const text = new TextDecoder('utf-8').decode(buffer);
  const commentMatch = text.match(/<!--([\s\S]*?)-->/g);
  if (commentMatch) {
    for (const c of commentMatch) {
      categoriesCount.software++;
      fields.push({
        id: `svg-comment-${fields.length}`,
        name: 'SVG Comment / Generator',
        category: 'software',
        value: c.replace(/<!--|-->/g, '').trim(),
        riskLevel: 'medium',
        description: 'Embedded XML comment in vector file',
      });
    }
  }
}
