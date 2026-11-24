# Security Policy

## Supported Versions

Security updates are applied to the latest release on the `main` branch.

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |
| < 1.0   | No        |

## Privacy Model

CleanShot is designed to run **100% client-side in your browser**:

- Files selected for metadata inspection, metadata removal, or watermark removal are processed locally in browser memory and Web Workers.
- No user files, metadata, or derived outputs are uploaded to any server.
- Because processing is local, security vulnerabilities in file parsers, WebAssembly runtimes, or browser-side dependencies are treated with high priority.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them privately using either of the following channels:

1. **GitHub Private Vulnerability Reporting (Preferred):**  
   Open a private advisory at `https://github.com/[YOUR_GITHUB_USERNAME]/[REPO_NAME]/security/advisories/new`.
2. **Email:**  
   Send details to **[YOUR_EMAIL]** with a description of the issue, reproduction steps, and any affected file format or browser version. Do not attach sensitive personal files.

### Response Timeline

- **Acknowledgment:** Within **48 hours** of receipt.
- **Triage & Initial Assessment:** Within **7 days**, including confirmation of severity and next steps.
- **Disclosure:** We will coordinate a fix and public advisory with you before any details are disclosed publicly.
