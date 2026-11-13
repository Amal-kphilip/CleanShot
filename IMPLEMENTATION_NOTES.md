# CleanShot Implementation Notes

## Architecture (Client-Side Only)
- All metadata inspection, lossless metadata stripping, Gemini watermark removal, image comparison, and batch ZIP creation run locally in the browser using Web Workers (with a main-thread fallback where module workers are unavailable).
- No server-side upload routes, server job stores, or server-mode downloads exist in the application.
- Security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and `Content-Security-Policy` permitting `'wasm-unsafe-eval'` and `blob:` workers/media) are configured in `next.config.mjs`.

## UI & Accessibility
- Static informational pages (`/privacy`, `/how-it-works`, `/faq`, `/formats`) are server-rendered; interactive tools and modals (`InspectorModal`, `SettingsModal`) use focused client boundaries.
- Dialogs share `useDialogAccessibility` for focus trapping, `Escape`-to-close, focus restoration, and body scroll locking.
- Supports reduced-motion preferences and dark/light theme synchronization.

## Engine & Format Handling
- Lossless metadata removal is supported for JPEG, PNG, WebP, GIF, and container-level cleaning paths where safe parser guarantees hold; SVG is sanitized as text markup.
- Unsupported formats (TIFF/RAW, HEIC/HEIF, AVIF, BMP, JPEG XL) are rejected safely rather than marked as cleaned.
- Tightened JPEG scan parsing, PNG chunk/CRC validation, WebP RIFF/chunk handling, GIF extension handling, and output verification.
- Metadata removal cannot guarantee that every vendor-private or unknown container field is removed from all real-world files; users should independently verify high-sensitivity outputs.
