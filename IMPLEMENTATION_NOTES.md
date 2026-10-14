# CleanShot update notes

## UI redesign
- Applied the supplied black-and-lime editorial reference to the home page: serif hero typography, hairline framing, lime accents, a framed inspector showcase, responsive feature sections, and low-cost scroll reveals.
- Added reduced-motion support for reveal/progress transitions and made the root theme dark on first paint.
- Applied the same serif heading treatment to the secondary pages and improved header/navigation styling.
- Improved upload keyboard access, modal focus handling, honest processing progress, and cleanup of thumbnail object URLs.

## Correctness and privacy fixes
- Corrected server-mode downloads to fetch the actual stored output or request a ZIP from the job API, instead of trying to download an empty client buffer.
- Correlated server responses to stable client file IDs so duplicate filenames do not map to the wrong result.
- Added explicit client/server per-file, batch, and count checks. Server request routes include size checks and best-effort process-local throttling; production deployments still need ingress body-size limits and a distributed rate limit.
- Removed retention of original raw metadata summaries from server job state and stopped doing an unused pre-clean inspection in server mode.
- Refused to mark TIFF/RAW, HEIC/AVIF, BMP, and JPEG XL as cleaned until safe lossless support exists. The obsolete TIFF helper now rejects input rather than returning a potentially unsafe rewrite.
- Tightened JPEG scan parsing, PNG chunk/CRC validation, WebP RIFF/chunk and metadata-flag handling, GIF extension handling, and output verification. Unknown container chunks/variants now fail safely where the parser cannot confidently preserve semantics and remove metadata.
- Added optional orientation-only EXIF retention and made unsupported/error states explicit in the inspector.
- Hardened the standalone inspect API with request/file size limits and best-effort rate limiting.
- Rebuilt the sample PNG and WebP fixtures to be genuinely decodable and fixed the fixture generator's destination path.
- Updated SEO descriptions, format claims, the privacy page, FAQ, and the lossless technical notes to avoid claims the implementation cannot substantiate.

## Validation in this environment
- `node node_modules/typescript/bin/tsc --noEmit`: **passed**.
- Direct image-engine checks on bundled JPEG, PNG, WebP, and SVG examples: **passed**; representative metadata strings were removed and unsupported BMP was rejected.
- Independent Pillow decode-and-compare for bundled JPEG, PNG, and WebP before/after outputs: **passed** for the test examples (1x1 JPEG/PNG, 2x2 WebP).
- `npm test`: **not runnable here** because the uploaded `node_modules` lacks `@rollup/rollup-linux-x64-gnu`.
- `next build`: **not runnable here** because the uploaded `node_modules` lacks `@next/swc-linux-x64-gnu` / `@next/swc-linux-x64-musl`. Network package installation was unavailable in this environment, so these optional platform packages could not be restored.

## Remaining production checks
1. On a network-enabled development machine, run `npm ci`, `npm test`, and `npm run build` before deployment.
2. Configure a strict upload/body limit and shared rate limiting at the hosting edge for both server APIs. The code-level throttle is only per-process.
3. Server jobs use in-memory storage, so server mode is not durable across restarts or independent serverless instances. Use sticky routing or durable temporary storage if reliable server-mode downloads across instances are required.
4. SVG sanitization is not an XML security certification, and metadata removal cannot guarantee that all possible vendor-private data is removed from every real-world file. Independently inspect high-sensitivity outputs.
