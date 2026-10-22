# Dependency review — October 21, 2026

The owner authorized a focused maintenance pass while preserving the current technology stack and user-facing behavior. This supersedes the outstanding findings from the September 11 review. Review date uses America/New_York; the evidence timestamps are October 22 UTC.

## Findings and fixes

A fresh request to npm's bulk advisory endpoint checked **105 unique package names** and their locked versions. It returned **13 advisories across three dependencies**. The same check after the updates returned **zero known advisories**. This is a point-in-time dependency check, not a guarantee against unknown vulnerabilities.

| Dependency | Before | After | Remediation |
| --- | --- | --- | --- |
| esbuild under Drizzle's legacy loader | 0.18.20 | 0.25.12 | Scoped override for `@esbuild-kit/core-utils` to the already-pinned root esbuild using `$esbuild`. |
| sharp under Cloudflare's local emulator | 0.35.2 | 0.35.5 | Wrangler 4.130.0 → 4.151.3 brings Miniflare 5.20261019.1-beta and patched sharp/libvips binaries. |
| undici under the same emulator | 7.29.0 | 7.29.1 | Included by the Wrangler/Miniflare update. |

The main esbuild version, Drizzle Kit/ORM, Playwright and PGlite remain pinned at their existing versions. No runtime settings, database schemas, production data, application source or user interfaces were changed. The stable Drizzle Kit release still uses the deprecated legacy loader, so the scoped override is retained and covered by executable tests. Remove that override when an adopted stable upstream release no longer requires it; the deprecated-loader notices are not outstanding advisories from this scan.

The findings addressed were:

- esbuild: [development-server response disclosure](https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99).
- sharp: [libheif vulnerabilities](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c) and [librsvg vulnerability](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).
- undici: [WebSocket decompression error](https://github.com/nodejs/undici/security/advisories/GHSA-3wwx-pv8p-q78v), [orphaned retry response](https://github.com/nodejs/undici/security/advisories/GHSA-pmjh-fq2x-6v4x), [retry response splitting](https://github.com/nodejs/undici/security/advisories/GHSA-r53p-7pc4-xj5r), [unrequested subprotocol](https://github.com/nodejs/undici/security/advisories/GHSA-rfgv-xxqx-mfg5), [unbounded decompression](https://github.com/nodejs/undici/security/advisories/GHSA-3xpg-4rpp-hhhm), [cached cookies](https://github.com/nodejs/undici/security/advisories/GHSA-2jfj-6hjv-fm6j), [response truncation](https://github.com/nodejs/undici/security/advisories/GHSA-2gqq-gqf2-x968), [TLS validation bypass](https://github.com/nodejs/undici/security/advisories/GHSA-w293-vg96-wgc3), [unsafe-method caching](https://github.com/nodejs/undici/security/advisories/GHSA-8436-99hf-9mmv), and [WebSocketStream close handling](https://github.com/nodejs/undici/security/advisories/GHSA-rx4f-c7p8-82vq).

These packages are development tools. The previous review found no use of the vulnerable development-server or image-decoding features in the deployed application. They are not bundled into its Worker.

## Disclosure scope

The September 11 authorization was reaffirmed for this maintenance pass on October 21. Only package names and exact versions were submitted in the audit request body. No source files, project name, map/account data or credentials were included. The service still receives ordinary request metadata. The script calls the bulk endpoint directly and fails on an error; it does not fall back to sending the full dependency tree. See [npm's endpoint documentation](https://docs.npmjs.com/cli/v11/commands/npm-audit/#audit-endpoints).

Automatic install audits and automatic deployment remain disabled. No new scheduled audit or reminder was created. Future reviews should preserve this limited disclosure scope and revisit it before changing providers or sending additional information.

## Verification

- Source: `04f600eedd8d08bc6bad8bcd26c840bf55e8b7dc` on `redesign/node-interactions`.
- **68/68 local checks passed**, report `build/verification/2026-10-22T01-24-36-599Z-32236/summary.json`.
- **68/68 hosted checks passed** from a clean Linux install on the same source: [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/39705542929), completed October 21 at 9:29 PM EDT (October 22, 01:29 UTC).
- New `tests/tooling.test.mjs` exercises both legacy-loader TypeScript transforms, unchanged-schema generation, a disposable generated SQLite migration that is actually executed, and a Cloudflare deployment dry run.
- Local Miniflare/workerd smoke check passed for the homepage, a client module, safe unconfigured sign-in behavior, and private-configuration protection.
- Clean installation and dependency-tree validation passed. Audit evidence: `build/maintenance-audit-before.json` and `build/maintenance-audit-after.json`; hosted evidence: `build/maintenance-hosted-verification-evidence.json`.
- The rebuilt application is byte-for-byte identical to the prior Worker: SHA-256 `c5016920e74adbb37c2ce80f0047db54704a612ca58830bf100fec75ba21978b`. Live verification also matched all 64 client files and the homepage, configured sign-in, account access checks, and security headers.
- **No production deployment or database migration was needed. Worker 70 remains live.** This maintenance item is complete; routine future dependency checks remain normal upkeep.
