# Map Library and comparison modes

Implemented September 10, 2026 and deployed September 11 at 03:22 UTC. Final public-URL verification passed: the checked frontend assets match the local build and public endpoint checks pass. See [deployment status](deployment-status.md) for the active version and verification details.

## Delivered

- Library landing with My maps, Comparisons & arguments, and derived Pods; search, descriptive cards, private/shared labels and creation buttons.
- Explicit map selection and map/source/pod links. Unavailable links return to Library. The existing comparison/proposal/version links continue to work.
- One Comparisons destination with Compare/Argument modes, map owners, proposal version and agreement state in a common header.
- Shared maps chosen inside Comparisons, with source detail, copy/adapt and co-sign history. The old catalog is no longer a main destination.
- Inline child buttons and a selected-node action menu with keyboard and touch support. Map edits retain the existing inspector and ownership boundaries.
- Account menu for file tools and sign out; derived pod labels; local Argument draft/camera fixes included.
- Camera initialization corrected when a previously hidden map is opened. Portable exports explicitly use UTF-8 on Windows.

## Verification

Application and account suites cover graph validation, ownership, proposal revisions, authored reasons, review, persistence and concurrency. The browser test uses two isolated sessions and an in-memory store with the real account projection and authorization functions. It exercises Library startup, choosing/creating maps, inline children, shared comparison creation, bilateral agreement, authored reasoning, mode drafts, saved routes, source copy/history access, Pods and narrow screens. It never writes test records to the live database.

Run the browser test with HARMONIOUS_PLAYWRIGHT set to an installed Playwright module entry point and npm run test:browser. It uses installed Edge by default; HARMONIOUS_BROWSER can select another installed Playwright channel. Screenshots are saved under ignored build/design-review/.

## Remaining product decisions and acceptance

The owner should still review the checklist on their real PCs. Automated browser checks do not substitute for judging whether the layout and reasoning language fit the intended process.

Pod authoring versus derivation, merged agreement cards, argument outcomes and richer elicitation remain deferred as agreed. Existing derived pod views are not new authored pod records.

The internal discover mode/IDs and exploreNode() adapter remain for the portable contribution workflow. Their visible entry points are replaced; they are not an extra navigation layer. Historical prototype documents retain their original terminology. The separate Library controller now owns object navigation, while ParticipationUI retains co-sign mutations and source detail.

This release requires no additional database migration and preserves existing authentication settings. It can roll back to the preceding Argument Worker without undoing the earlier comparison/argument migrations.
