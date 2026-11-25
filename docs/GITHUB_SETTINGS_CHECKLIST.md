# GitHub Repository Settings Checklist

These settings cannot be configured via repository files and must be applied in the GitHub UI (or via the `gh` CLI where supported) after pushing `main`.

> [!IMPORTANT]
> **Settings → Code security → "Private vulnerability reporting" must be enabled** for the reporting flow documented in [SECURITY.md](../SECURITY.md) and the link in `.github/ISSUE_TEMPLATE/config.yml` to work.

## 1. Branch Protection / Ruleset on `main`

In **Settings → Rules → Rulesets** (or **Settings → Branches → Branch protection rules**):

- [ ] Target branch: `main`
- [ ] Require a pull request before merging
- [ ] Require status checks to pass before merging (`Typecheck, Lint, Test & Build`)
- [ ] Block force pushes
- [ ] Require linear history (or enforce squash-only merges)

```bash
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  /repos/Amal-kphilip/CleanShot/branches/main/protection \
  -f required_status_checks='{"strict":true,"contexts":["Typecheck, Lint, Test & Build"]}' \
  -F enforce_admins=true \
  -f required_pull_request_reviews='{"required_approving_review_count":1}' \
  -F restrictions=null \
  -F required_linear_history=true \
  -F allow_force_pushes=false \
  -F allow_deletions=false
```

## 2. Merge Settings

In **Settings → General → Pull Requests**:

- [ ] Allow squash merging only (disable merge commits and rebase merging)
- [ ] Automatically delete head branches after merging

```bash
gh repo edit Amal-kphilip/CleanShot \
  --enable-squash-merge \
  --enable-merge-commit=false \
  --enable-rebase-merge=false \
  --delete-branch-on-merge
```

## 3. Security & Analysis

In **Settings → Code security and analysis**:

- [ ] Enable **Dependabot alerts**
- [ ] Enable **Dependabot security updates**
- [ ] Enable **Secret scanning**
- [ ] Enable **Push protection**
- [ ] Enable **Private vulnerability reporting** *(Required for SECURITY.md)*

```bash
gh api --method PUT /repos/Amal-kphilip/CleanShot/vulnerability-alerts
gh api --method PUT /repos/Amal-kphilip/CleanShot/private-vulnerability-reporting
```

*(Note: Secret scanning and push protection for public repositories can be toggled in **Settings → Code security and analysis** or via the repository security settings API if enabled for your account/plan.)*

## 4. Discussions

In **Settings → General → Features**:

- [ ] Enable **Discussions** (linked from `.github/ISSUE_TEMPLATE/config.yml`)

```bash
gh repo edit Amal-kphilip/CleanShot --enable-discussions
```

## 5. About Box (Description, Website & Topics)

On the repository's main page, click the gear icon next to **About**:

- [ ] **Description:** `Client-side file metadata inspector, metadata remover, and Gemini watermark remover. 100% local in your browser.`
- [ ] **Website:** `https://cleanshot-gules.vercel.app/`
- [ ] **Topics:** `privacy`, `metadata`, `exif`, `nextjs`, `client-side`, `watermark-remover`

```bash
gh repo edit Amal-kphilip/CleanShot \
  --description "Client-side file metadata inspector, metadata remover, and Gemini watermark remover. 100% local in your browser." \
  --homepage "https://cleanshot-gules.vercel.app/" \
  --add-topic privacy,metadata,exif,nextjs,client-side,watermark-remover
```

## 6. Social Preview Image

In **Settings → General → Social preview**:

- [ ] Upload a `1280×640` social preview image based on `public/logo-dark-full.png` (GitHub UI only; no `gh` CLI endpoint).

## 7. Labels Used by `.github/labeler.yml`

In **Issues → Labels**, create the labels used by `.github/labeler.yml` (if they do not already exist):

- [ ] `engine`
- [ ] `ui`
- [ ] `tests`
- [ ] `docs`
- [ ] `ci`
- [ ] `dependencies`
- [ ] `pinned` (used by `.github/workflows/stale.yml`)
- [ ] `security` (used by `.github/workflows/stale.yml`)

```bash
gh label create engine --color "0E8A16" --description "Metadata & watermark processing engine" --repo Amal-kphilip/CleanShot
gh label create ui --color "1D76DB" --description "UI components and Next.js pages" --repo Amal-kphilip/CleanShot
gh label create tests --color "BFD4F2" --description "Test suites and fixtures" --repo Amal-kphilip/CleanShot
gh label create docs --color "0075CA" --description "Documentation and guides" --repo Amal-kphilip/CleanShot
gh label create ci --color "EDEDED" --description "GitHub Actions and CI/CD" --repo Amal-kphilip/CleanShot
gh label create dependencies --color "0366D6" --description "Dependency updates" --repo Amal-kphilip/CleanShot
gh label create pinned --color "A2EEEF" --description "Exempt from stale issue/PR closing" --repo Amal-kphilip/CleanShot
gh label create security --color "D73A4A" --description "Security-related issues or PRs" --repo Amal-kphilip/CleanShot
```

## 8. Pin Repository

On your GitHub profile (`https://github.com/Amal-kphilip`):

- [ ] Click **Customize your pins** and pin `CleanShot` (GitHub UI only).
