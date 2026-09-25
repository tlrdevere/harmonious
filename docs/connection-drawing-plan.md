# Connection drawing and collapsed branches

Prepared September 25, 2026, after the owner's `harmonious3.png` screenshot. **Status: implemented; 46/46 release checks passed.** Baseline: `f45e6c4`, Worker version 43. [Deployment status](deployment-status.md) identifies the published version. This replaces the open browser-discrepancy investigation and prioritizes connection meaning and drawing over changes to radial node placement.

## Implementation record

The two proposed increments were completed together in parallel and verified as one release. This avoids a temporary mixture of old and shared routing without delaying the collapsed-connection fix. Final report: `build/verification/2026-09-25T20-33-53-484Z-66488/summary.json`. Desktop and narrow branch lists, the Map/Create edge menu, and the computed routing preview were visually inspected.

- Projection groups exact saved pairs before classifying visible, collapsed, filtered, missing or unavailable endpoints. Only actual visible pairs draw edges. Folded branches provide accessible counts, actual-pair details, retained historical records and a two-endpoint reveal.
- The shared bounded router is used by Map/Create, ComparisonCanvas, source discussion edges and historical reasoning. Clear diagonals are direct; detours have small rounded corners. Source geometry is independent of the camera and the shared mode. The [computed before/after preview](design/connection-routing.html) preserves identical sparse, branching and deep radial coordinates.
- Source edge details preserve multiple meanings and actual direction; opposing semantic directions use arrows at both ends of one path. Structural organization remains explicit in detail. Map/Create exposes inspection and owner Edit/Remove, with a quiet all-visible default inside View options.
- Browser coverage exercises the screenshot's two hidden pairs, genuine visible pairs, both-side collapse, repeated titles/paths, withdrawn history and follow-ups, filtered reveal, unchanged saved data, retained zoom/folds, keyboard focus, counterpart state, on-map edge editing, mobile bounds and cancelled draft removal. Routing/model coverage includes mixed visibility, missing/unavailable sources, blocked endpoints, caching, unchanged coordinates and exact inference targets.

The sections below preserve the agreed plan and acceptance criteria. No migration or saved-map rewrite is required.

## What the screenshot establishes

The line labeled **2 connections · Collapsed branches** is an aggregate of cross-map connections. It is not the ordinary parent–child branch line. At least one real endpoint is hidden under a collapsed branch. The renderer substitutes visible ancestors, groups records by those displayed ancestors, and draws a line between their card boundaries.

In the screenshot, this makes Taylor's **Status Quo** and TylerTest2's lower **New example** appear directly connected. The label's 2 counts distinct original node pairs, not children, individual judgments, responses, or people agreeing. The screenshot does not identify the actual hidden node titles or whether those records are earlier agreements, counterpart links, or historical comparison proposals. Their saved identities have not been inspected or changed.

Code evidence:

- `dist/comparison-layout.mjs`, `visibleComparisonEndpoint()`: returns actual node ID, visible ancestor ID, and `proxy` status.
- `dist/discussion-ui.mjs`, `draw()`: passes only the displayed key into `groupComparisonConnections()`, then uses distinct original pairs to produce the screenshot's exact label.
- `dist/conversation-tree.mjs`, `groupComparisonConnections()`: combines records by the substituted visible pair.
- `dist/discussion-ui.mjs`, `point()`: resolves the actual targets to ancestor boxes again for drawing.
- `dist/comparison-routing.mjs`: routes the aggregate around cards, producing the rounded L. Changing its curvature alone would leave the misleading endpoints intact.

The owner now sees the line in both browsers. The browser-specific concern is closed; no browser workaround or new reset-view control is part of this plan.

## 1. Fix the meaning of collapsed connections first

**Rule: an edge may connect two visible cards only when those cards are the actual endpoints.** A collapsed ancestor can indicate that connections exist inside its branch, but cannot stand in for a connected descendant at the end of an edge.

| Actual endpoints | Canvas presentation |
| --- | --- |
| Both visible | One edge for the actual node pair; multiple saved meanings remain available in its detail. |
| One hidden by collapse | No substitute edge. A compact branch-connection indicator on the collapsed ancestor opens the real pairs. |
| Both hidden by collapse | No substitute edge. Each relevant collapsed ancestor can provide access; both access points refer to the same underlying pairs. |
| Hidden by a frame filter | Do not call it a collapsed branch. Keep the record in the existing list and explain the filter when revealing it. |
| Missing or inaccessible | Preserve permitted history and source status; do not manufacture an endpoint or reveal private wording. |

Suggested collapsed indicator: a quiet connection icon plus a count, with accessible text **“2 connections inside this branch.”** Integrate it into the existing node attachment area. Do not add a toolbar row or a floating canvas label. If both ends are hidden, two access points must not become two saved connections or inflate the overall count.

Selecting the indicator opens a compact on-map list of actual pairs. Show node titles, owners, and enough branch context to distinguish repeated titles such as New example. Group by exact unordered node pair; keep individual record direction, author and meaning inside the group. The count is distinct pairs, while details can contain multiple judgments or historical records for one pair.

Keep the meanings explicit:

- Earlier Agreement/Disagreement records remain attributed judgments.
- Counterpart links identify corresponding nodes and do not imply agreement.
- Earlier comparison proposals retain their historical status.
- Modern Endorse/Disagree/No position records remain their current attachments; this work does not turn them into new pair edges.

Each pair offers **Show connected nodes**. Reveal only the necessary source paths, preserve zoom and unrelated folds, pan as needed, select the actual endpoints and open their existing detail. Respect unsaved-draft safeguards. If a frame filter hides a source, explicitly expose that frame as part of this requested reveal. Do not expand branches automatically just because the canvas renders.

Reveal both stored endpoints explicitly: the current general interaction reveal follows the first conversation anchor, while existing counterpart/older-record reveal paths fit the selection and change zoom. Extend the shared reveal behavior rather than reusing either unchanged. When expanding removes the originating branch badge, move keyboard focus to the revealed source/connection or its open detail; never restore focus to a detached control.

Counterpart matching, empty counterpart spots, request suppression, response permissions and source history must continue using actual node IDs. Hiding a line must not make a linked node appear unlinked or offer another counterpart request.

Implementation: retain rich endpoint descriptors through projection; group by actual pairs before classifying visibility. Keep separately named collections for visible edges and collapsed-branch access points. Integrate existing relationship follow-ups with those access points so a removed proxy line does not strand its replies or history. Avoid a wholesale change to `visibleComparisonEndpoint()`: other attachment badges legitimately use it to remain discoverable under collapsed parents.

Primary files: `dist/conversation-tree.mjs`, `dist/discussion-ui.mjs`, `dist/comparison-layout.mjs`, and attachment styles. Reuse existing source-reveal and detail handlers; touch counterpart handling only where access must be preserved.

**Acceptance:** the screenshot's misleading ancestor-to-ancestor line disappears. The user can still find both real pairs, reveal their real nodes and inspect every authorized record. A genuinely saved connection between the visible cards remains visible and never absorbs hidden-descendant records into its label.

## 2. Use one routing policy across the four views

Keep radial node positions. Standardize how connections reach those positions in Map/Create, Inquiry, Compare and Argument.

Recommended policy:

1. Use a direct line when the corridor is clear; use the shortest practical detour with small rounded bends when needed to avoid cards and labels.
2. Stop at node boundaries with consistent clearance. Never cross an endpoint's face or another node's text.
3. Remove the special ring-arc branch style as a separate visual convention. Curvature should serve routing rather than suggest a different kind of relationship. Review a small before/after preview of sparse, branching and deep maps before applying this policy throughout.
4. Use the same geometry in all modes for an identical source graph and expansion state. Pan and zoom transform the existing routes. Necessary rerouting after expansion is expected; a mode switch alone must not select a different route.
5. Keep one visible edge per actual node pair, preserving multiple meanings and any directed relationships in details. Arrowheads must reflect saved direction, including an honest representation if directions conflict. Decorative frame guides must be noninteractive and excluded from relationship counts.
6. Preserve quiet styling and a generous invisible hit area. Hover and keyboard focus get the same modest highlight and label behavior; support reduced motion.

Use one shared geometry helper. Adapt the existing card-avoiding routing utilities before introducing another solver; stop maintaining separate cubic curves in the map editor, radial arcs for some branches, and unrelated cross-map paths. Account for label placement without allowing several labels to stack over a node. Bound route calculation and reuse it during pan/zoom so larger maps remain responsive.

Primary files: `dist/app.mjs`, `dist/compare-canvas.mjs`, `dist/discussion-ui.mjs`, `dist/layout.mjs`, `dist/comparison-routing.mjs`, `dist/reasoning-layout.mjs`, relevant styles and any small shared helper.

**Acceptance:** before/after examples retain the same node coordinates, have no lines across cards, and use the same drawing conventions across modes. The distinctive extra line in the screenshot is addressed by step 1, not disguised by this cosmetic work.

## 3. Align connection inspection and visibility in Map/Create

Use the shared edge hit area and source detail conventions. Selecting an edge in Map/Create should expose its endpoints, relationship meaning/direction, and existing Edit/Remove actions in a compact on-map menu, with the panel still available. Inquiry, Compare and Argument keep their own grammar actions on that same source connection; consistency does not mean copying critique controls into Inquiry.

Review the editor's Selected node / All visible / Hide control. Its present scope is semantic connections, while hierarchy links remain. Clarify that scope, use a quiet all-visible default for semantic edges, and reserve labels/highlights for focus rather than relying on hidden connections to reduce clutter. Suppressing a semantic edge must not silently replace it with an apparently different structural meaning. Use existing View options space rather than adding controls to the main canvas header.

Check keyboard selection, Escape/Close focus return, exact target labels, on-map popover placement, optional panel behavior and narrow screens. Do not add a new interaction type or change ownership rules.

## 4. Verify and release in two increments

**First release:** step 1 and its regression coverage. This fixes the misleading semantics without waiting for the broader visual design.

**Second release:** the reviewed routing preview, shared implementation, and Map/Create edge inspection/visibility cleanup from steps 2–3.

For each increment:

- Reproduce the screenshot's asymmetrical collapse in a disposable fixture with two distinct cross-map pairs. Test one/both ends hidden, a genuine visible pair alongside hidden pairs, repeated titles, reversed endpoints, multiple meanings on one pair, and several shared ancestor levels.
- Cover collapsed descendants separately from filtered, deleted and inaccessible sources, including mixed cases where the two ends have different visibility reasons. Assert correct counts, preserved authorized history, no new data, and no privacy leak or misleading partial pair.
- Verify branch-list selection and Show connected nodes with keyboard and pointer; preserve unrelated folds, zoom, drafts and mode rules. Preserve the linked-counterpart request restriction.
- Update the obsolete assertion in `tests/conversation-edges.test.mjs` that currently expects hidden pairs to share an ancestor line. Extend active counterpart/mode-consistency browser suites and routing/model tests; add Map/Create edge tests for the second increment.
- Inspect screenshots at ordinary and narrow sizes and under dense expansion. Check one edge per actual pair, node avoidance, reduced motion and stable geometry across modes.
- Run the complete release verification/build, publish through the established authorized beta process, verify live assets and account gates, and update the user checklist and release notes.

This is planned as presentation-only work with no migration or saved-map rewrite. Manual dragging, a replacement radial layout, automatic merging and new relationship categories remain outside this work. The earlier cross-depth counterpart-placement study is separate from this connection-drawing fix.
