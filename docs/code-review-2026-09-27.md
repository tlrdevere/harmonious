# Code and view-consistency review — September 27, 2026 (UTC)

Reviewed the existing `redesign/node-interactions` checkout following the owner's request on September 26 in New York. The review started from `2cda1f550556f70414e402ea31584af91ea5c5e2`; Worker 44 remains the published release.

## Scope

- Map/Create, single-source browsing, Inquiry, Compare and Argument rendering, connection identity/direction and inspection.
- Interaction menus, summaries, search, saved choices, source changes, editing history and draft safeguards.
- Account state, imported-map ownership/confidence, persistence and source access boundaries.
- Existing regression suites, portable export and production asset packaging.

Consistency follows each view's purpose: source browsing is read-only; map editing is owner-controlled; Inquiry, Compare and Argument retain their separate actions. This pass does not introduce any of the owner's deferred features.

## Confirmed defects and corrections

| Defect | Correction |
| --- | --- |
| The single-source map browser drew only tree branches, omitting semantic connections visible in Map/Create and the shared comparison modes. | Render saved source connections with shared routing, exact-pair grouping, direction and read-only details; avoid drawing a second structural route for the same pair. |
| After a node changed frame or lost its citation, or a connection changed type, editing a saved interaction retained incompatible selections invisibly. Every save then failed. | Show incompatible saved selections under Earlier choices, using their original labels. Require explicit clearing before saving current choices, preserve the prior revision, and explain when a source no longer permits a dispute edit. |
| Importing another participant's map as an owned private copy retained their confidence scores and attributed them to the importing participant. | Clear confidence when the original owner differs from the current account; preserve that account's own backup scores, including zero. |
| Deleting a node from the optional editor panel left its on-map action menu visible, allowing the deleted wording to reopen. | Close stale node/connection controls through the common successful branch-deletion path. |
| The shared views offered My confidence on legacy topic, question and explainer nodes even though the confidence form only accepts position nodes. Selecting it closed the menu without opening a form. | Use the same eligibility rule as Map/Create in all three shared modes; preserve existing legacy node kinds. |

The new checks exercise these failures directly. Existing source snapshots, histories and changed-source warnings remain supported; the separate proposed change-context discoverability project stays deferred.

## Deferrals recorded

The [current deferral list](next-work-plan.md#deferred-work) now also includes return-visit catch-up, participant introduction/worked examples, and the proposed change-context discoverability follow-up.

## Verification

- **46/46 release checks passed** on the final local working tree, including all six browser suites, disposable account/database tests, portable exports, production build and complete asset checks. Report: `build/verification/2026-09-27T01-44-43-379Z-78148/summary.json`.
- Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Microsoft Edge on Windows. This is a local verification run, separate from the earlier GitHub run on `e42f83a`.
- Extended `map-grammar-browser`, `mode-consistency-browser` and `account-autosave` regressions cover the five corrected defects, keyboard navigation, narrow canvases, unchanged saved source graphs and preserved prior revisions.
- Inspected the final desktop and narrow source-connection screenshots. Shared connection-detail headers now keep Close accessible while longer detail lists scroll.
- The new source-connection module is included in both the explicit production asset list and the standalone exporter. No dependencies changed.
- The initial sandboxed baseline passed 44 checks before the bundler encountered a parent-directory read restriction. Its build and asset checks passed when rerun with normal filesystem access; the final complete run above passed with that access. No build-code workaround was introduced.

## Release boundary

These are local review changes. No deployment, GitHub push, database migration, dependency update, registry audit or production account write is part of this review. [Deployment status](deployment-status.md) remains the authority for the published version.
