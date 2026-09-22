# Inquiry mode foundation

Implemented on `redesign/node-interactions`, starting from the protected working baseline. This is a local redesign preview, not a live deployment.

The owner chose to keep this first step easy to revise: Inquiry has its own menu area, with interactions and recipient responses to be specified next. Some Compare actions may move to Inquiry, and a shared action name may eventually have different options in different modes.

## Current behavior

- Map creation/editing keeps its existing Maps destination.
- Within the shared canvas, the mode selector is **Compare / Inquiry / Argument**.
- Inquiry uses the same source maps and camera. Selecting a node or connection opens a source inspection panel with a short placeholder for forthcoming tools.
- Its new interaction menu is unassigned. It does not copy Ask/Answer or critique controls from the other modes, create a second graph, or reclassify historical contributions.
- Compare and Argument retain their current interactions. Their unfinished forms are parked when changing modes and restored when returning; changing targets still uses the existing discard safeguard.
- Existing map navigation, branch expansion, definitions, view options and personal settings remain shared canvas facilities. Inquiry is not an application-wide read-only permission or a new authorization boundary.
- Inquiry uses the same in-session mode retention as Compare/Argument. There is no new persisted mode field, schema migration, account setting or production data change.

## Where the next changes belong

`dist/inquiry-ui.mjs` owns Inquiry's menu presentation. The shared mode selector is in `dist/reasoning-ui.mjs`; routing selections to the appropriate menu remains in `dist/discussion-ui.mjs`. Both the hosted asset list and portable export include Inquiry.

Define the forthcoming interaction matrix before sharing forms across modes: mode, actor, eligible target, interaction, menu choices, saved meaning, and recipient responses. Reuse low-level form/save helpers where behavior truly matches; keep mode-specific choices separate. Existing records must retain their original meaning and authored history when an action moves or gains a variant.

## Review

The portable exporter creates `review/Harmonious-inquiry-preview.html`, which opens the sample maps in Inquiry directly. It is local and uses sample/offline data. The existing working site remains at the release documented in deployment status.

The focused Inquiry browser test checks peer mode controls, node/edge inspection, unassigned menus, preserved Compare/Argument drafts and camera, access to Maps, zero new saved records, and desktop/mobile layout. The aggregate verification also exercises the existing workflows and both build formats.

Verified September 22, 2026: all 47 registered checks passed across the original and resumed runs, including the portable preview and complete Worker module graph. Local evidence: `build/verification/inquiry-resumed-20260922/summary.json`, with provenance for the first 36 checks in `build/verification/2026-09-22T20-14-10-894Z-17748/summary.json`. Desktop and 390px mobile screenshots were inspected. Two existing browser assertions were stabilized: collapsed-camera checks use reduced motion, and grouped outcomes are checked by author rather than assuming a fixed map order. These are test corrections, not changes to outcome ordering or canvas animations.

The protected tag and `main` still point to `b9ebc57fb0b317c820b8a0c4990ede7f36a5ce82`. No live deployment or database changes were made.
