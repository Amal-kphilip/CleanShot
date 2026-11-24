# GitHub Repository Settings Checklist

These settings cannot be configured via repository files and must be applied in the GitHub UI (or via the `gh` CLI where supported) after pushing `main`.

Replace `[YOUR_GITHUB_USERNAME]`, `[REPO_NAME]`, and `[DEMO_URL]` before running commands.

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
  /repos/[YOUR_GITHUB_USERNAME]/[REPO_NAME]/branches/main/protection \
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
gh repo edit [YOUR_GITHUB_USERNAME]/[REPO_NAME] \
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
- [ ] Enable **Private vulnerability reporting**

```bash
gh api --method PUT /repos/[YOUR_GITHUB_USERNAME]/[REPO_NAME]/vulnerability-alerts
gh api --method PUT /repos/[YOUR_GITHUB_USERNAME]/[REPO_NAME]/private-vulnerability-reporting
```

*(Note: Secret scanning and push protection for public repositories can be toggled in **Settings → Code security and analysis** or via the repository security settings API if enabled for your account/plan.)*

## 4. Discussions

In **Settings → General → Features**:

- [ ] Enable **Discussions** (linked from `.github/ISSUE_TEMPLATE/config.yml`)

```bash
gh repo edit [YOUR_GITHUB_USERNAME]/[REPO_NAME] --enable-discussions
```

## 5. About Box (Description, Website & Topics)

On the repository's main page, click the gear icon next to **About**:

- [ ] **Description:** `Client-side file metadata inspector, metadata remover, and Gemini watermark remover. 100% local in your browser.`
- [ ] **Website:** `[DEMO_URL]`
- [ ] **Topics:** `privacy`, `metadata`, `exif`, `nextjs`, `client-side`, `watermark-remover`

```bash
gh repo edit [YOUR_GITHUB_USERNAME]/[REPO_NAME] \
  --description "Client-side file metadata inspector, metadata remover, and Gemini watermark remover. 100% local in your browser." \
  --homepage "[DEMO_URL]" \
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
gh label create engine --color "0E8A16" --description "Metadata & watermark processing engine" --repo [YOUR_GITHUB_USERNAME]/[REPO_NAME]
gh label create ui --color "1D76DB" --description "UI components and Next.js pages" --repo [YOUR_GITHUB_USERNAME]/[REPO_NAME]
gh label create tests --color "BFD4F2" --description "Test suites and fixtures" --repo [YOUR_GITHUB_USERNAME]/[REPO_NAME]
gh label create docs --color "0075CA" --description "Documentation and guides" --repo [YOUR_GITHUB_USERNAME]/[REPO_NAME]
gh label create ci --color "EDEDED" --description "GitHub Actions and CI/CD" --repo [YOUR_GITHUB_USERNAME]/[REPO_NAME]
gh label create dependencies --color "0366D6" --description "Dependency updates" --repo [YOUR_GITHUB_USERNAME]/[REPO_NAME]
gh label create pinned --color "A2EEEF" --description "Exempt from stale issue/PR closing" --repo [YOUR_GITHUB_USERNAME]/[REPO_NAME]
gh label create security --color "D73A4A" --description "Security-related issues or PRs" --repo [YOUR_GITHUB_USERNAME]/[REPO_NAME]
```

## 8. Pin Repository

On your GitHub profile (`https://github.com/[YOUR_GITHUB_USERNAME]`):

- [ ] Click **Customize your pins** and pin `[REPO_NAME]` (GitHub UI only).
