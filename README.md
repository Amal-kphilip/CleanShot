# CleanShot

> Bulk, lossless photo metadata (EXIF/GPS) stripper with zero visual quality loss. Runs 100% in-browser.

---

## ✨ Features

- **Lossless & Zero-Recompression**: Strips metadata directly from binary segment streams (JPEG APPn/COM, PNG chunks, WebP RIFF). 0% pixel data re-encoded.
- **Bulk & Fast**: Process 100+ photos at once with Web Workers. Drag-and-drop, folder upload, or clipboard paste (`Ctrl+V`).
- **Metadata Inspector**: Inspect EXIF tags before stripping, with GPS coordinates and sensitive leak alerts.
- **Color Fidelity**: Preserves ICC color profiles (sRGB, Display P3) to prevent color shifting.
- **Instant ZIP Download**: Generates uncompressed (STORE mode) ZIPs client-side without server bandwidth bottlenecks.
- **100% Private**: Runs entirely in your browser. Photos never leave your device.
- **Supported Formats**: JPEG, PNG, WebP, GIF, HEIC/HEIF, AVIF, TIFF, DNG, RAW, SVG.

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

---

## 🐳 Docker

```bash
docker-compose up -d --build
```

---

## 📄 License

MIT
