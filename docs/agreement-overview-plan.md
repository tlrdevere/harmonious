# Joined agreement cards and comparison overview

Design direction accepted September 29, 2026. The joined-card and overview implementation is complete and undergoing release verification; [deployment status](deployment-status.md) identifies the published application. This follows the owner's request to make agreement, disagreement and asymmetry obvious when zoomed out, and acceptance of the illustrated options.

## Selected direction

Use the recommended **joined card plus simplified overview**. Two mutually agreeing counterparts appear as one wide card with both original faces and a shared Both agree band. Preserve both wordings, authors, confidence values, individual controls and source connections. A compact single-card presentation remains an alternative, rather than part of this first increment.

This is a derived comparison display. It creates no shared source node or common wording and does not merge either user's parents, children, reasons or histories. SQ/TA/GS colors and owner colors retain their roles; prominent relationship bands, symbols and shape carry assessment status.

## Implementation sequence

### 1. Derive complete pair display states

Extend the presentation helpers around `nodeAssessment` and `counterpartAssessment` in `dist/interaction-presentation.mjs`. Keep the existing mutual-assessment API compatible for its consumers and introduce a complete display descriptor where needed.

- Both current reciprocal Agree assessments: **Both agree**, eligible for the joined appearance.
- Both current reciprocal Disagree assessments: **Both disagree**, separated faces with a strong shared disagreement treatment.
- Different explicit assessments: **Mixed positions**, with each person's exact state shown. Agree / Disagree must differ from Agree / No position and Disagree / No position.
- Two explicit No position assessments: **Both no position**, a neutral state with no agreement or disagreement verdict.
- Missing or withdrawn assessment: show Not assessed for that side; do not classify missing information as an opposing opinion. Retain the available assessment on the other side.
- Source changes requiring review: expose **Needs review** and suspend strong mutual styling until assessments are current.

Use only permitted, available records. Preserve latest-created assessment precedence, withdrawal without resurrection, privacy filtering, and unlink receipts. New visual aggregation requires a valid reciprocal one-to-one ordinary-node pair; historical multiple links and unavailable endpoints retain truthful contextual details.

### 2. Render joined cards and distinct pair treatments

Use existing comparison layout groups to attach shared decoration in `dist/discussion-ui.mjs`, `dist/compare-canvas.mjs` and `dist/library.css`. Join eligible visible, adjacent agreeing faces with one outer shape and shared band, keeping their existing positions and pair footprint.

Each half remains independently selectable and attributable. The band describes a derived result; it is not a new editable assessment. Preserve access to the real counterpart connection and its history through an explicit accessible control if decoration covers the gap.

Use a separated shape for mutual disagreement and a split status treatment for asymmetric positions. Pair symbols with labels and color; avoid relying on red versus green alone. Mark pending/no-position/review states distinctly.

Remove the joined treatment immediately when agreement stops being current, the pair is unlinked or an endpoint becomes unavailable. Collapse/filtering must not fabricate a second visible node: retain the established collapsed/unavailable counterpart status. Keep each source edge attached to its actual originating half.

### 3. Add a zoom-aware overview

At low zoom, suppress unreadable detail in favor of simplified pair shapes and per-person symbols. Preserve both endpoints and their accessible identities. Use a minimum readable on-screen size for important markers, with sufficient hit areas and a deliberate collision policy; do not silently aggregate unrelated pairs into one apparent agreement.

Use the camera update path to change presentation without rerunning layout or changing node positions, zoom or anchors. Overview begins below 45% and returns to detail at 55%, with the intermediate range preventing flicker.

At very small scales, colored joined/split silhouettes stay on every eligible pair. Larger named symbols appear where they can avoid other nodes, ghosts, controls and markers; their original-node targets are at least 44 screen pixels. Crowded pairs remain separately accessible under **pairs need closer zoom**. Selecting one explicitly centers it and raises zoom to at least 75%. The list never reports an aggregate agreement state for different pairs.

Keep named full assessments available on selection and through keyboard navigation. Show joined, separated and split shapes consistently across Compare, Inquiry and Argument, retaining their existing differences in available actions. Source browsing and Map/Create retain individual source-node presentation. Portable comparison exports must include the same display behavior.

### 4. Verify and publish

Add focused model and browser coverage for every state combination, reversed map sides, privacy, withdrawn/latest assessments, changed sources, unlink/relink, collapse/filtering and historical multiple links. Verify differing node wording and confidence remain separate, and merging creates no source edits.

Inspect desktop and narrow views at 100%, 75%, 50%, 25% and 10%, plus extreme zoom and Fit on dense comparisons. Check marker collisions, readable symbols, edge identity, selection, keyboard access, screen-reader names, touch targets, camera retention and portable files. Preserve the blank-click dismissal and text-selection/panning fixes.

Run the complete release checks and hosted checks on the exact application commit, then publish and verify public assets through the established release process. No database migration is expected for this presentation-only increment. Update deployment status, current workflow, grammar and the owner checklist with the actual release evidence.

## Acceptance

- Agreement is recognizable as a joined pair without reading small text.
- Mutual disagreement, explicit asymmetry, no position, missing assessment and needs-review states remain distinguishable at a distance.
- Zoom and assessment changes do not move the map or change source data.
- Both originals and their connections remain independently readable and actionable.
- Existing deferrals remain in place. Automatic merging of source records and the separate Aligned / In tension proposal are not part of this visual grouping.
