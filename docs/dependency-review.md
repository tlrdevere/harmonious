# Dependency review — September 11, 2026

The owner explicitly authorized sending dependency names and exact versions to npm's advisory service on September 11, after discussing the disclosure risk. The check completed for 103 unique package names from `package-lock.json`. No source files, map/account data, credentials or project name were sent in the request body.

## Results and applicability

- **esbuild 0.18.20**, nested under `@esbuild-kit/core-utils`, brought in by the retained Drizzle development tooling: [moderate advisory GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99). The issue affects esbuild's development server. Harmonious builds use the separate pinned esbuild 0.25.12 and do not use the nested package's serve feature. Follow up by upgrading/replacing the older loader tooling; do not expose an affected development server.
- **sharp 0.35.2**, brought in by Wrangler's Miniflare local emulator: [high advisory GHSA-rgj7-g3m4-5g8c](https://github.com/advisories/GHSA-rgj7-g3m4-5g8c). The advisory concerns decoding untrusted HEIF/AVIF content, with patched prebuilt dependencies available in sharp 0.35.4. This application has no image-processing or image-upload flow, and sharp is not included in its deployed Worker. Upgrade the emulator's dependency through a tested compatible package update before using that path for untrusted images.

These are outstanding development-tool advisories, not a finding that the hosted application's account data has been compromised. No dependency versions were changed in this feature pass. The production Worker contains the application modules and frontend assets, not esbuild or the local emulator.

## Revisit the disclosure decision

The owner asked to return to this decision later. A reminder is scheduled for next Friday at 10:00 AM, with instructions to pause after one reminder. Also revisit the decision before a wider beta or changes to audit providers. The disclosure is the software inventory and exact versions; a provider can correlate that with vulnerability information and ordinary request metadata. Do not treat this approval as permission to upload source code, credentials or participant data.
