# Inquiry mode

Implemented on `redesign/node-interactions`, starting from the protected working baseline. The owner subsequently authorized live deployment; see [deployment status](deployment-status.md) for the current release.

The first foundation deliberately left Inquiry's actions unassigned while the owner supplied the interaction rules. That placeholder has now been replaced by the agreed [interaction grammar v4](interaction-grammar-v4.md). The linked document is the current specification and implementation record.

## Current behavior

- Map creation/editing retains its Maps destination. The shared canvas has peer **Inquiry / Compare / Argument** modes, in that left-to-right order.
- Inquiry offers **Request reason**, **Request explanation**, **Propose alternative**, and **Offer reason** on another participant's ordinary node or connection.
- Menu choices follow the interaction and target. Comments and Point to a node are optional. Other opens a free-form field wherever offered.
- A reference is one node from a map both participants can access. A user can instead create a node on their own shared map; the form makes that map change explicit.
- The intended recipient can Respond within Inquiry. Requests offer Answer / I don't know / Other; proposals and offers offer Accept / Reject / Other. Response outcomes are mutually exclusive.
- Compare records Endorse / Disagree / No position. Argument provides context-sensitive Dispute reasoning. Inquiry does not offer critique controls.
- Recording or accepting an interaction does not automatically revise, copy, or merge map content. A separate reviewed application can add a reason or revise an explanation on the owner's map. Reasons offered about edges remain attached interactions; there is no invented node-to-edge inference.
- Modes share source maps and camera state. Unfinished forms are parked when changing modes and restored when returning. Changing targets still uses the discard safeguard.
- Navigation, branch expansion, confidence, definitions, view options, and personal settings remain shared facilities. Inquiry is not a separate authorization boundary.
- Saved interactions now include their originating mode and grammar metadata. Production records have not been changed.

## Implementation

`dist/interaction-grammar.mjs` owns mode vocabulary, menu filtering, recipient rules, and optional references. `dist/interaction-ui.mjs` presents Inquiry alongside the other interaction modes; `dist/interaction-application.mjs` and `dist/interaction-application-ui.mjs` provide explicit map-change previews. The shared selector remains in `dist/reasoning-ui.mjs`, with canvas integration in `dist/discussion-ui.mjs`.

The earlier foundation's statement that there were no persisted interaction fields or migration applied only to the placeholder milestone. The database migration is applied and recorded locally as `supabase/migrations/20260923002452_interaction_grammar_v4.sql`, matching the connector-generated deployment timestamp.

## Local review and coverage

The portable exporter creates `review/Harmonious-interactions-preview.html`, opening the example comparison in Inquiry. It uses local sample/offline data. The existing working site remains at the release documented in [deployment status](deployment-status.md).

`tests/interaction-grammar-browser.test.mjs` replaces blank-menu expectations with requests/offers, recipient responses, parked drafts, optional references and newly authored referenced nodes, reviewed map changes, and mobile layout. Grammar/account/database tests cover filtering, internal Signals, ownership, source freshness, and shared-reference privacy. Map, counterpart, and confidence browser suites remain active.

The old `inquiry-browser.test.mjs` is explicitly listed under `harmoniousLegacyBrowserTests` in `package.json`: its expected empty menu is no longer intended behavior. The [grammar implementation record](interaction-grammar-v4.md) describes the other intentional browser replacements. All 44 active release checks passed on September 22, 2026; report: `build/verification/2026-09-22T22-53-25-909Z-38200/summary.json`.

The earlier placeholder milestone was verified with 47 registered checks across its original and resumed runs; that historical result does not certify the new grammar. Its reports remain at `build/verification/inquiry-resumed-20260922/summary.json` and `build/verification/2026-09-22T20-14-10-894Z-17748/summary.json`.

The protected baseline and local source backup remain the references described in [redesign preparation](interaction-redesign-preparation.md). The live release applies validation functions without rewriting existing stored records. After new grammar records exist, use a forward fix rather than an older Worker that cannot read them.
