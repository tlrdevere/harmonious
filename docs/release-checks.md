# Repeatable release checks

Run the complete local verification with:

```text
node scripts/verify.mjs
```

The runner uses installed runtimes directly; npm is not needed to run it. It never installs dependencies, queries a vulnerability registry, applies a live migration, deploys, or pushes code. All account/browser/database checks use their existing disposable fixtures. No production Cloudflare or Supabase credentials are required.

## What runs

1. Every `node tests/…` command registered in the package `test` script.
2. Every command in `test:accounts`, including the disposable PostgreSQL engine and database authorization/atomicity checks.
3. The Python portable exporter, including its embedded JavaScript syntax check.
4. Every registered browser walkthrough. Additional `tests/*-browser.test.mjs` files are discovered automatically, so a new adoption walkthrough cannot silently fall outside the release runner. Navigation checks reopen the newly generated portable file.
5. The independent production build and `tests/account-build.test.mjs`, covering built asset/module routing and security behavior.

The order is deliberate: browsers read fresh portable artifacts, and the final asset checks read a fresh production build. Failure stops the run and leaves later stages marked `not_run`. A successful preflight or a subset run outside this entry point is not a complete release pass.

```text
node scripts/verify.mjs --list
node scripts/verify.mjs --preflight
```

`--list` prints the exact checks without launching runtimes. `--preflight` checks test files, installed dependencies, Python, the Playwright version and browser launch without running application tests. The full run performs that preflight automatically.

## Runtime setup

Use Node 24, Python 3, the locked development dependencies, and Playwright **1.62.1**, matching the bundled runtime used for the existing walkthroughs. The Python exporter needs only Python's standard library. The runner resolves an installed `playwright` package automatically; the package and lockfile must pin its exact version for a clean checkout.

On this Windows workspace, use the existing bundled runtimes without a new package installation:

```powershell
$env:HARMONIOUS_PYTHON='C:/Users/Acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$env:HARMONIOUS_PLAYWRIGHT='C:/Users/Acer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
$env:HARMONIOUS_BROWSER='msedge'
node scripts/verify.mjs
```

On another computer, omit `HARMONIOUS_PLAYWRIGHT` to use the locked local package, or set it to that computer's installed `playwright/index.mjs`. It must be a filesystem path, not a `file://` URL. `HARMONIOUS_PYTHON` accepts an executable path; otherwise the runner tries the usual Python 3 commands. The Node executable running the verifier is added to the child PATH for the portable exporter.

The default browser is Edge on Windows and Chromium on other systems. `HARMONIOUS_BROWSER` explicitly overrides it. Install the matching browser beforehand; the verifier will fail early instead of silently downloading one. For a clean development checkout, install locked packages with `npm ci --no-audit --no-fund`, then install Chromium with `node node_modules/playwright/cli.js install chromium` (add `--with-deps` on a suitable Linux CI machine).

## Results and diagnostics

Each invocation writes a separate `build/verification/<timestamp>-<process>/` directory containing per-check logs, a machine-readable `summary.json`, and `summary.md`. Reports list runtime versions and completed, failed and unrun checks. Existing browser scripts retain screenshots in `build/design-review/`. A failed check returns a nonzero exit code; no failed step is silently skipped or retried.

Generated portable files in `review/` and the production bundle in `build/cloudflare/` are refreshed by verification. They are local artifacts, not a deployment. Keep the tested source revision, verification report, and any later deployment evidence together in the release record. A local pass does not establish that a hosted workflow or a live two-account walkthrough passed.

## Verified isolated install — 2026-09-19

The subsequent routing/confidence release also passed the complete runner: **38/38** checks using the same installed runtimes, including the new confidence model/browser checks and comparison routing tests. Its report is `build/verification/2026-09-19T04-54-59-120Z-81660/summary.json`; its built Worker SHA-256 is `baedd6607f6b5f45c72b0a80455a6d4da21a00a458ff4fc7d7a47f44240e4182`. This was a working-tree verification, not another clean-install or hosted CI run. Seven browser walkthroughs passed; the public post-deployment check matched all 39 client files and the homepage. No package versions changed or registry audit ran.

A fresh dependency installation and the complete **35-check** runner passed in `review/ci-clean/`. That directory contained 134 tracked or explicitly reviewed new source files copied from the working tree, without existing dependencies, generated artifacts, Git metadata, environment files or production credentials. It is an isolated working-tree snapshot, not a hosted checkout.

The official npm 11.6.2 archive was checked against its registry SHA-512 integrity value. `npm ci --no-audit --no-fund` installed 57 Windows packages with normal installation scripts, including successful esbuild/workerd checks. Empty npm credential configuration and a restricted set of inherited environment variables kept the run independent of the developer's application configuration. The lockfile was unchanged, and no vulnerability audit ran.

The aggregate run used Node 24.19.0, Python 3.12.14, the freshly installed Playwright 1.62.1 resolved automatically from this copy, and the existing Edge browser. All model, account, PostgreSQL, six browser walkthroughs, portable export, production build and built-asset checks passed. The final run took approximately 116 seconds and completed at `2026-09-19T04:23:12.430Z`.

- Local report: [summary.json](../review/ci-clean/build/verification/2026-09-19T04-21-16-872Z-45228/summary.json).
- Per-file source hashes: `review/tools/ci-clean-snapshot.json`; all 134 files still matched immediately after verification, before this result was documented.
- Built Worker SHA-256: `644a0a94eac296e193b01d3e9f99d34493ae3960ea13f9539c9c12da87dde809`, identical to the main workspace build.

The Windows filesystem sandbox initially blocked esbuild's ancestor-directory lookup. The final local run had the required filesystem access; it still used disposable fixtures and no production credentials. After deployment, the unchanged adoption migration was renamed to its applied timestamp (`20260919042425`) and the database test path updated; the full database suite passed again. Hosted Ubuntu/Chromium remains **unverified**. The pinned Chromium executable was not cached locally, and this check did not download it or run a hosted workflow.

## Hosted CI preparation

`.github/workflows/checks.yml` uses the same runner on Ubuntu 24.04 with Node 24, Python 3.13 and the locked Playwright package. It installs the matching Chromium browser and required system libraries, grants only `contents: read`, does not persist checkout credentials, and uses no production secrets. The workflow runs no deployment command. Package installation disables npm's automatic audit; it does not repeat the separate software-inventory disclosure check.

The workflow is intentionally **manual-only** while hosted Linux/Chromium validation remains unverified. Editing it locally neither synchronizes GitHub nor starts a hosted run. After the source and exact dependency lock have been reviewed and synchronized, run **Release checks** for that revision, inspect its logs, and only then consider enabling automatic push/pull-request triggers. A hosted clean checkout must pass with installed locked dependencies and no machine-specific paths. Failure logs and screenshots are retained for seven days; only disposable fixture content should appear in them.

The setup follows the official [Playwright CI guidance](https://playwright.dev/docs/ci-intro), [checkout credential option](https://github.com/actions/checkout), [Node setup](https://github.com/actions/setup-node), [Python setup](https://github.com/actions/setup-python), and [artifact retention options](https://github.com/actions/upload-artifact). The repository uses its plain Node browser scripts rather than Playwright Test's separate runner.

Registry vulnerability checks remain a separate decision under [the saved dependency-review preference](dependency-review.md).
