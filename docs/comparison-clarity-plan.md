# Comparison connections and counterpart controls

Prepared September 28, 2026 from the owner's notes on `harmonious4.png`, `harmonious5.png`, `Harmonious6.png`, and `Harmonious7.png`. **Status: implemented; all 48 local release checks passed; hosted verification and publication pending.** Continue in the existing repository on `redesign/node-interactions`. The baseline is Worker 47, documented in [deployment status](deployment-status.md).

## Outcome and scope

Make Comparisons easier to read and let a participant link existing counterpart nodes from either side. Deliver four changes together: stable selection, direct counterpart controls, removal of decorative frame connections, and clearer routes for sibling connections.

Keep the radial layout, real parent relationships, saved connection meanings, authorship, and current mode rules. No database migration or saved-map rewrite is expected. A counterpart means comparable material; it does not imply agreement. Initial side-by-side placement remains provisional and does not create links from matching titles, sibling order, or copied-map provenance.

The [existing deferral list](next-work-plan.md#deferred-work) stays unchanged. Cross-depth counterpart placement, manual dragging, replacement layout, and other deferred features are outside this pass. The cancelled frame-copy investigation remains closed. **Aligned / In tension judgments between particular nodes require a separate design decision**, described below; they are not part of this implementation.

## Implementation record

All four changes are implemented. Selection-driven reservations and implicit camera fitting are removed; saved unanswered requests retain their requested spots. Existing counterpart choosing works from either side, requires an explicit choice, and groups linked pairs while retaining each recorded meaning and author. Account submissions check both current wording and ancestor paths, commit atomically, and retain stable node/link identities when retrying a lost acknowledgment. Shared linked-node reveal preserves zoom.

The shared comparison canvas omits decorative frame spines. Source paths use consistent solid styling and saved arrow direction. A bounded deterministic source-route batch allocates separate sibling ports when needed and reuses the same geometry for visible strokes, hit areas, labels, and inspection across Map/Create, source browsing, and shared modes. Endpoint highlighting and the compact connection key are implemented. Review also repaired the existing map-emphasis button grouping and retained appropriate dimming for source lines.

All **48/48 local release checks passed**, including eight browser suites, account/database checks, standalone export and the production build. Report: `build/verification/2026-09-28T22-03-45-484Z-88496/summary.json`. Desktop/narrow screenshots cover the five-child selection case, collapsed frames, explicit requests, source editing/browsing, and deep/dense graphs. A portable-browser smoke check also passed. Hosted verification and publication are pending and will be recorded in [deployment status](deployment-status.md); the approved scope and acceptance criteria follow below.

## 1. Make selection stable

**Problem:** Selecting an unlinked node reserves an empty opposite slot and displaces the node already there. Two identical five-child maps reproduce the arrangement in `Harmonious6.png`. Ordinary selection can also trigger an automatic camera fit once both sides have selected nodes.

Planned behavior:

- Selecting or inspecting an already visible node leaves all node positions, camera position, zoom, folds, and frame filters unchanged. Switching selection between the two maps must not introduce extra layout slots.
- Remove reservations caused solely by selection in `comparisonCounterparts()`. Show **No counterpart linked** in the selected node's counterpart controls instead of manufacturing a blank card on the map.
- Preserve reservations for saved, active, unanswered counterpart requests under the existing placement policy. Opening or cancelling a request form creates no reservation. Such a spot represents a recorded request and should say **Counterpart requested**, with the appropriate request or response controls. Closing, answering, or fulfilling the request follows the existing state rules.
- Remove the automatic fit caused merely by having two selected nodes. Retain deliberate Fit, linked-node reveal, and search navigation actions.
- Creating a real link or changing a request may legitimately update the layout. Merely opening, cancelling, or closing an inspector/chooser must not do so.
- Keep the frame's number as its child count; make its accessible label/tooltip explicit if it is currently ambiguous.

Primary files: `dist/counterparts.mjs`, `dist/compare-canvas.mjs`, `dist/counterpart-ui.mjs`, and focused comparison-layout tests. Do not replace the existing saved-link placement policy.

**Acceptance:** In the two identical five-child fixture, repeated selection of either Low union density node leaves both maps in exactly their preselection positions, with the same camera. No counterpart record is created. All five nodes in each map remain accessible.

## 2. Make counterpart actions direct and symmetrical

Replace the generic **Find or view counterpart** action with controls that describe their actual behavior. These are Compare actions; Inquiry and Argument retain their existing interaction grammar and parked drafts.

| Context | Action and result |
| --- | --- |
| Eligible unlinked ordinary node on either map | **Link counterpart** opens the opposite map's existing-node chooser directly. |
| Node with one or more linked counterparts | **View linked counterparts** lists the actual links with node titles, owners, and paths. Keep **Link another counterpart** available where permitted. |
| Other person's node, with the opposite map owned by the current participant | **Create counterpart in my map** creates a node only in the participant's own map, using the existing create-and-link flow. |
| Own unlinked node without an existing request | **Request counterpart** asks the other participant to provide one through the existing request workflow. |
| Existing request | **View counterpart request** opens its current state and the response, close, or reopen controls permitted for that participant. |

Chooser requirements:

- Show the source node and the opposite map/owner clearly. Use searchable eligible ordinary nodes, with frame and parent path to distinguish repeated titles. Show the selected node's wording before confirmation.
- Do not preselect a counterpart on the basis of matching text or sibling order. **Link counterpart** saves only after an explicit choice and confirmation; Cancel creates nothing.
- Keep existing cross-frame/depth eligibility. Explain a different frame in the chooser; do not redesign its placement. Exclude frame headings, unavailable/deleted nodes, and unsupported node types according to the existing validation rules.
- Split the current ownership checks: creating still requires ownership of the destination map; linking existing nodes permits either direction when the participant owns at least one endpoint and both nodes are accessible in this comparison.
- Linking changes the comparison's attributed record only. It must not change either source map's wording, revision, ownership, confidence, hierarchy, or sharing.
- Preserve multiple links; prevent duplicate exact pairs, including reversed selection order. Revalidate both endpoints and access on submission. Stale selections or save failures should produce a useful message and retain the draft for recovery.
- Group linked-counterpart list entries and counts by distinct opposite node/pair, not record count: an earlier judgment and a counterpart record may describe the same pair. Keep individual meanings, link authors, and history available in detail.
- Preserve author-only withdrawal of a link record, retaining both nodes and its history. A pending-request placeholder can return only when no applicable active link remains and both maps/source are still available. Removed or inaccessible sources must not produce fictitious replacement nodes.
- If there are no eligible candidates, explain that state. Offer creation only when the destination belongs to the participant; otherwise retain the appropriate request action. Do not leave an enabled empty submission.
- Keep request fulfillment derived from actual active links. A linked node must not offer a new Request counterpart action; closing or answering a request must not fabricate a link.
- Preserve draft-discard safeguards, mode parking, keyboard focus, Escape/Close, narrow-screen usability, and historical link access. Revealing a hidden linked node uses the existing truthful endpoint-reveal behavior.

Primary files: `dist/counterpart-ui.mjs`, `dist/interaction-ui.mjs`, `dist/counterparts.mjs`, and existing discussion validation/account tests. Review all entry points, including node menus, request details, and request placeholders; changing only the first menu would leave the asymmetry elsewhere.

**Acceptance:** Each account can start at its own node or the other participant's node, choose the intended existing counterpart, and see one attributed saved link after reload. Neither source map changes. Create remains restricted to one's own map, and request responses retain their existing permissions.

## 3. Remove decorative frame lines and clarify styles

**Problem:** The comparison renderer draws automatic SQ-to-TA and TA-to-GS guides for both maps. These are not authored relationships. Their overlapping dashes explain much of `harmonious5.png`. Source-side dashing is also applied inconsistently when semantic paths are created separately.

Planned behavior:

- Omit decorative `spine` paths from the shared comparison renderer in Inquiry, Compare, and Argument. Keep frame anchors, card colors, labels, and solver structure intact. Preserve genuine saved connections between actual endpoints.
- Use thin solid neutral lines for source-map organization. A typed source connection uses the same consistent base style plus arrowheads for its saved direction. If organization and semantics share a pair, show one route and retain both meanings in its detail.
- Remove the rule that makes a source line dashed solely because it belongs to the second displayed map. Owner identity remains on cards and in connection details.
- Keep current counterpart and historical relationship types distinguishable without changing their meanings. Do not turn legacy Agreement/Disagreement records into new authoring actions or erase their existing styling/history.
- Add a compact **Connection key** disclosure in the existing view-options area: organization, directed source connection, and counterpart. Historical judgments are identified explicitly in their details. Dashes must not be presented as confidence or uncertainty.
- Use the same source-line convention in Map/Create and source browsing where those paths are rendered. Decorative-guide removal is limited to the shared comparison canvas; do not casually delete layout-model edges used by other renderers.

Primary files: `dist/compare-canvas.mjs`, `dist/discussion-ui.mjs`, `dist/source-connections-ui.mjs`, `dist/app.mjs`, and relevant styles/view options. Confirm actual module names and shared call sites during implementation.

**Acceptance:** With both maps collapsed to SQ/TA/GS, there are no automatic frame-to-frame lines. Expanding either map shows consistently styled source connections; saved cross-map links and directed meanings remain inspectable.

## 4. Route sibling connections so their parents are clear

**Problem:** In `harmonious4.png`, the SQ-to-Low union density path shares a long vertical segment with SQ-to-Socialists before turning. Both still have SQ as their parent. The router avoids cards but does not account for other connection paths.

Implementation approach:

1. Group source connections by actual map/node pair before routing, preserving every saved meaning and direction. Keep one visible path for each pair.
2. Build a deterministic batch of source routes using stable identities and world coordinates. Allocate separate attachment points for siblings on a crowded side of a card, then prefer short routes that avoid long shared segments and apparent T-junctions with unrelated pairs.
3. Extend the existing bounded router rather than introducing a new layout solver. Cards remain hard obstacles; existing routes influence route cost. Keep direct paths when clear, with small rounded detours where needed. Do not move nodes to simplify a line.
4. Reuse the same route for the visible path, transparent hit target, arrowheads, labels, and inspection highlight. `DiscussionUI.position()` and `SourceConnectionsUI.position()` can otherwise reroute and overwrite a canvas-level fix; all relevant callers must agree on the result.
5. Preserve saved semantic direction when a child-to-parent reason reuses a structural parent-to-child pair. Test opposite directions and multiple meanings explicitly.
6. Highlight the whole connection and its two actual endpoint cards on pointer hover and keyboard focus. Keep existing selection details and accessible labels. Touch users get the same identification through selection.
7. Bound search and cache routes using the endpoint geometry, obstacle set, route set, and routing policy. Selection, pan, zoom, and mode changes alone must not alter source geometry or cause a fresh layout.

Dense graphs may still need crossings. Avoid implying a junction at a crossing, and preserve complete endpoint highlighting so a path remains traceable. Node avoidance and correct endpoints take priority over eliminating every crossing. Any bounded fallback must remain visible/inspectable and must never substitute a different endpoint or silently drop the relationship.

Primary files: `dist/comparison-routing.mjs`, `dist/reasoning-layout.mjs`, `dist/compare-canvas.mjs`, `dist/discussion-ui.mjs`, `dist/source-connections-ui.mjs`, and Map/Create routing call sites. Apply the shared source-route policy across Map/Create, source browsing, Inquiry, Compare, and Argument where appropriate; keep mode-specific actions distinct.

**Acceptance:** The screenshot's two sibling routes are individually traceable back to SQ without the long shared segment that creates a false branch. No route crosses a card face; the radial coordinates and saved parent IDs stay unchanged. Hover/focus identifies the correct endpoints in every view.

## Implementation sequence and verification

Implement in three reviewable increments, then verify as one coherent release:

1. **Selection and counterpart controls:** add the five-child regression fixture, remove selection reservations/automatic fit, and implement direct symmetric choosing with existing permissions and requests.
2. **Line presentation:** remove comparison spines, apply the source style policy, and add the compact key. Capture collapsed/expanded before-and-after views using the same data.
3. **Routing clarity:** add sibling ports and route-aware avoidance, unify route consumers, and add complete endpoint highlighting. Inspect sparse, screenshot-shaped, deep, and dense fixtures without changing their node coordinates.

Extend existing suites where possible; do not add tests that merely assert new button strings or mirror the algorithm. Cover observable failures and invariants:

| Coverage | Required evidence |
| --- | --- |
| `counterparts.test.mjs`, `comparison-layout.test.mjs` | Selection creates no reservation or displacement; actual requests still follow their state; links remain explicit; unequal child counts and repeated titles do not create false matches. |
| `counterpart-browser.test.mjs` | Two accounts; both starting directions; explicit picker choice/cancel; multiple and duplicate links; request states; reload; unchanged source maps; keyboard and narrow width. Replace the old expectation that selection creates an empty counterpart card. |
| Account/discussion checks | Either-endpoint ownership, third-party read-only behavior, unavailable/deleted sources, exact-pair duplicate protection, and no accidental grant to edit another map. |
| `comparison-routing.test.mjs` and layout checks | Screenshot sibling overlap, adjacent paired-card obstruction, separate ports, stable routing order, card/label avoidance, arrow direction, one route per pair, unchanged coordinates, and bounded dense cases. |
| Map and shared-mode browser suites | Actual SVG paths, hit targets, and arrowheads agree after redraw; hover/focus highlights actual endpoints; no decorative comparison spines; selection/camera stability; unchanged geometry across shared modes; cancelled/parked drafts survive. |
| Existing release checks | Collapsed-branch access to real pairs, unavailable history, saved definitions/confidence, node-face editing, copying, standalone export, account/database boundaries, and production asset build still pass. |

Use disposable local account fixtures for tests, not the owner's production maps. Visually inspect the four screenshot scenarios at desktop and narrow widths, with each map alternately collapsed, plus a dense example. Include a cold reload and repeated Inquiry/Compare/Argument switches.

Also exercise empty candidate maps, cross-frame choices, link withdrawal, closed/reopened requests, cancelled request composition, and declined draft discard. Preserve existing explicit-reservation tests for saved requests. If routing introduces a shared client module, register it in both the client-asset and standalone-export lists so browser and portable builds include it.

Once implementation and focused checks pass, run the complete existing `scripts/verify.mjs` release runner. Worker 47's 47/47 result is the baseline, not evidence that this new work is verified; record the actual new run and count. Update the current workflow, interaction grammar, counterpart workflow, user checklist, and this plan to match what is implemented.

For the implementation release, follow the established publication process: commit the reviewed application changes, push `redesign/node-interactions`, run hosted Release checks on that exact revision, deploy only after passing, then verify public assets/account gates and record the resulting Worker version in deployment status. Leave automatic deployment disabled. This planning task itself makes no application or deployment changes.

## Separate design decision: Aligned / In tension

After the clarity fixes, define whether the user wants an attributed assessment of a particular node pair. Decide whether it attaches only to counterpart pairs or can also connect different issues that conflict, who may record it, how differing assessments coexist, and what the line/detail should show.

Do not infer that assessment from similar wording, spatial adjacency, counterpart links, or an Endorse/Disagree action toward a single node. Do not revive retired paired-judgment authoring as a menu-label change. This is a follow-up design question, not an implementation blocker and not a new entry on the owner's deferral list.
