# Comparison positioning implementation plan

Prepared September 28, 2026 from the owner's feedback on `harmonious 10.png` and `harmonious 11.png` and the accepted unpaired-by-default direction. **Status: implemented; release verification in progress.** Work remains in the existing repository and branch `redesign/node-interactions`. Worker 48 is the live baseline; [deployment status](deployment-status.md) records publication. The [diagnosis](comparison-positioning-follow-up.md) preserves the preceding slot and spacing findings.

## Implementation record

The implementation follows the decisions below using the existing client modules. It separates saved counterpart state from eligible adjacency, rebuilds a valid forest of occupied groups, and solves spacing from real card/control rectangles with six bounded angle candidates. Compact ghosts and exact animated rectangles are shared by layout, source routing, discussion/reasoning placement, and Fit. Link/withdraw preserves the initiating node's screen position and zoom; cancellation, focus return, and mode-local drafts remain protected.

Focused unit and two-account browser checks pass, including 100 filter/expansion patterns, 50 conflicting pair sets, dense/deep trees, repeated link/withdraw, reversed source maps, request responses, unavailable history, ownership, and source immutability. The portable-browser smoke check also passes for initial ghosts, explicit linking, cancellation, mode geometry, and unchanged real-node counts. Desktop and narrow screenshots were inspected at both Fit and readable working zooms. The complete local/hosted release result and publication are recorded in [deployment status](deployment-status.md).

Measured occupied extents in canvas units (rounded; same card scale and fixture, SQ only):

| Visible children A / B | Worker 48 comparison | New comparison, including ghosts | Create A reference |
| --- | --- | --- | --- |
| 4 / 0 | 1051 × 961 | 860 × 610 | 696 × 777 |
| 5 / 0 | 1363 × 1142 | 874 × 897 | 869 × 917 |
| 6 / 0 | 1363 × 1246 | 874 × 1006 | 869 × 996 |
| 8 / 0 | 1844 × 1517 | 1217 × 1160 | 1136 × 1206 |
| 5 / 2 | 1515 × 1142 | 1102 × 1166 | 869 × 917 |
| 5 / 8 | 2112 × 1517 | 1546 × 1329 | 869 × 917 |
| 4 / 4, unrelated | 1319 × 961 | 1217 × 1160 | 696 × 777 |

Five children with the other map collapsed produce the same new extent as 5 / 0. The five-child comparison uses about 50% less occupied area than before. Equal four-child maps now have eight independent groups rather than four provisional pairs, so not every comparison becomes smaller. Evidence: `build/positioning-baseline-metrics.json`, `build/positioning-current-metrics.json`, and `build/design-review/positioning-*.png`. Visual and geometry checks do not promise crossing-free dense graphs; the broader cross-depth optimization remains deferred.

## Result to deliver

Ordinary nodes appear together only when a participant has explicitly recorded a qualifying pair. Otherwise each visible node has its own position and a compact ghost counterpart control. Comparisons uses space appropriate to the visible cards and controls, with balanced radial branches and Create as the visual reference. SQ, TA, and GS headings remain corresponding structural anchors.

Deliver pairing, ghost states, and spacing together. Existing comparisons use the new display automatically without rewriting maps or manufacturing links. Preserve real parents, source wording, ownership, confidence, discussion history, selection/camera stability, and existing linking/withdrawal permissions.

## Decisions for this increment

- **Remove provisional pairing completely.** Node order, similar wording, matching IDs in different maps, and copy provenance must not give ordinary nodes a common pair position. Each solo position is identified by map ID plus node ID.
- **Honor deliberately saved pairs.** Active `correspondence` records have placement priority. For compatibility, active historical `relationship` records continue to qualify as explicitly recorded pairs under the existing policy; details retain their Earlier Agreement/Disagreement labels and authors. They are not converted into new counterpart records. Old `workspace.comparisons` records remain readable connections/history and do not become a new source of adjacency. Do not change server request/withdrawal rules as a side effect of the layout work.
- **One visible card per real node.** A node may have multiple links but at most one adjacent partner. Preserve the current deterministic priority: explicit correspondence first, then creation time and record ID, grouped by actual pair so duplicate meanings cannot create duplicate groups. All remaining links stay accessible.
- **Pair only visible endpoints in the same frame.** Cross-frame, filtered, collapsed, and unavailable endpoints retain truthful status and existing reveal/history access. A hidden child never transfers its counterpart identity to the visible parent.
- **Use a compact ghost.** Start with a 144 × 88 canvas-unit control beside a normal 252 × 166 card, with a 12-unit gap; mirror its side according to map identity. Show a dashed outline, status text, and one primary action. Use the same compact footprint for a sent request, with its full controls in the existing inspector. Tune these presentation constants during desktop/narrow visual review, keeping one geometry definition shared by layout and CSS. Ghosts are display elements, not nodes.
- **Leave clear space between unrelated groups.** Start with at least 44 units between group rectangles, compared with the existing 16-unit gap inside a real pair. Do not use a pair enclosure or counterpart line for unlinked groups. Keep map-owner markings distinct from frame colors.
- **No extra “unpair this accidental match” workflow is needed.** Provisional matches disappear automatically. Withdrawing an authored real link uses the existing action and history. When the last qualifying link is withdrawn, the node becomes unlinked unless an existing request supplies a different status. Another participant's active record cannot be removed implicitly.

## 1. Separate semantic state from visible placement

Primary file: `dist/counterparts.mjs`; integrate with the existing endpoint helpers in `dist/comparison-layout.mjs` and inspection in `dist/counterpart-ui.mjs`.

Add a pure, shared projection that answers two different questions: what permitted saved links/requests exist for this node, and which of those endpoints can participate in current placement. The current `counterpartLinks()` filters unavailable endpoints; its absence alone must not be interpreted as “never linked.” Do not broaden access or fetch information omitted by the account projection.

Use stable actual endpoint identities and existing visible/collapsed/filtered/missing/unavailable classifications. Retain link authors, meanings, distinct-pair counts, source health, and request state. Read only the records and metadata the participant is already authorized to see. If the comparison itself is no longer available, use the existing unavailable view and remove stale controls.

| State | Canvas treatment and action in Compare |
| --- | --- |
| No active qualifying pair and no request state taking precedence | Compact **No counterpart linked** ghost; **Link counterpart** opens the existing searchable chooser with no preselected candidate. |
| Saved active unanswered request, with no qualifying linked pair | Compact **Counterpart requested** ghost; recipient gets **Respond**, requester gets **View request**, through the existing request inspector. No second generic ghost. |
| **No position yet**, **Not applicable**, or closed request, with no linked pair | Compact request-state control opening the existing request/history. Retain permitted link, create, close, and reopen actions in the inspector. Do not portray a reply as a fresh unanswered request. |
| Qualifying pair visibly adjacent | Two actual cards with the normal pair gap and saved connection details; no empty ghost. |
| Linked elsewhere, in another frame, collapsed, or filtered | A compact linked-status control with **View linked counterparts** or the existing **Show connected nodes** reveal; no “No counterpart linked” ghost. |
| More than one distinct linked node | Expose the actual link count and all pairs in the existing list; at most one pair determines adjacency. |
| A permitted saved link has a missing/unavailable endpoint | **Counterpart unavailable** with only permitted history/details; do not expose hidden wording or show it as a newly unlinked node. |
| No second source map | Preserve the existing single-source view; no invented opposite-map ghosts. |

When linked and request records coexist, saved pair status takes visual precedence; the request/history remains inspectable. Where several exceptional link states coexist, use **View linked counterparts (N)** and list each status rather than assigning one misleading status to the whole node. A ghost means no currently recorded pair, not that the other person has no view on that topic.

Apply existing participant and ownership permissions to every action. A read-only viewer can see only permitted status/details and gets no enabled linking or response control; recheck eligibility when opening and submitting, including when availability changes while the comparison is open.

**Acceptance:** state is accurate for never-linked, withdrawn, requested, replied, closed/reopened, multiple, hidden, cross-frame, missing, and unavailable cases. Merely rendering or opening a ghost creates no node, link, request, stance, or saved layout record.

## 2. Rebuild display groups from occupied content

Primary file: `dist/comparison-layout.mjs`.

Replace sibling-path slot sharing with an explicit display-group pass:

1. Determine visible real nodes using the existing frame filters and independent expansion state. Keep source layouts/children/edges available for actual parent connections.
2. Create corresponding frame-heading groups only for headings visible under each side's independent filter, then select eligible saved pairs using the stable priority above. A frame group may contain one or two real headings; an entirely hidden frame contributes no group or bounds. Each ordinary group contains either one real node plus its compact status control, or two deliberately paired real nodes. A node is claimed at most once.
3. Give each group a stable ID from its actual members. Use map ID order, not the displayed A/B side or the current selection, to choose the anchor node for a two-node group. This preserves logical placement when source sides are swapped.
4. Build the radial display forest from those groups. A solo follows its own source parent's group; a pair follows its canonical anchor's source parent. Frame groups are roots. The other member's actual parent connection remains an edge to its real parent, not a rewritten parent relationship. Rebuild descendant group ancestry from current membership instead of retaining old sibling-index paths.
5. Validate a finite acyclic display forest with every group reachable from its frame. Remove vacated groups and empty leaves. Do not create root-level “displaced neighbor” slots; every unpaired node already has its own ordinary group. If malformed pair data would create an invalid display grouping, keep those real nodes as independent groups with their saved-link status; never drop a node, loop, or rewrite a source parent. Preserve history and expose the existing inspection route.

This keeps the existing same-frame cross-depth pairing capability and deterministic anchor choice. It does not attempt the separately deferred optimization of cross-depth counterpart placement. Multiple-pair chains must not merge three or more real nodes into one group or introduce cycles through non-anchor parent edges.

**Acceptance:** unrelated nodes never share a pair group, equal titles/order do not affect eligibility, all visible real nodes appear exactly once, and link/withdraw/reload leaves no empty layout slots. Source trees and saved records are byte-for-byte unchanged by display calculation.

## 3. Solve radial spacing for group dimensions

Primary file: `dist/comparison-layout.mjs`; isolate any reusable geometry helper so Create's existing layout defaults remain intact.

Use the existing radial arrangement as the starting model, but calculate separation from actual group rectangles: one or two visible frame headings, linked pair, and solo card with compact status control. Replace the blanket 1.8 horizontal / 1.3 vertical stretch and universal two-card offset. Distribute occupied groups in balanced upper/lower sectors, retain stable sibling order within source branches, and grow rings only where content needs clearance. Check rectangle collisions directly and use a bounded, deterministic spacing pass; no random or continuously running force simulation.

The sole fifth child below the frame is not inherently an error. Acceptance is a balanced, readable arrangement without excessive empty space or misleading branch paths. With one map collapsed, visible single-node groups must not reserve a second full card. With both maps expanded and no links, there are genuinely more independent groups than under the old provisional pairing; do not promise a smaller overall canvas by obscuring or falsely matching them.

Return explicit rectangles for cards, ghosts, and group bounds. Do not place ghosts into the map of real node positions. Use these rectangles consistently for collision checks, routing obstacles, animation, and Fit, including interpolated rectangles while a layout animation is running. Keep runtime work bounded on the existing deep/dense fixtures; reuse completed geometry during ordinary pan/zoom.

Record before/after bounds and same-zoom screenshots for four, five, six, and eight children, unequal five-vs-eight maps, and one side collapsed. Compare the five-child result with Create at the same card scale. Adjust the comparison spacing constants and solver until this review demonstrates improvement; a passing no-overlap check alone is insufficient.

**Acceptance:** cards and controls do not overlap, no abandoned slots affect bounds, normal card text remains readable at the same zoom, every real parent connection remains traceable, and the screenshot-10 layout is visibly more balanced. Swapping maps preserves equivalent identity-based grouping. Selection and non-layout actions produce identical geometry.

## 4. Render ghosts and reuse truthful geometry across modes

Primary files: `dist/counterpart-ui.mjs`, `dist/compare-canvas.mjs`, `dist/discussion-ui.mjs`, `dist/reasoning-ui.mjs`, and `dist/library.css`.

- Render compact controls from the shared semantic projection, not by treating all placeholders as sent requests. Refactor the current full-card `.counterpart-placeholder` styling into distinct unlinked, requested, and linked-status treatments without relying on color alone.
- A ghost's **Link counterpart** uses the existing chooser, ownership checks, latest-source review, atomic submission, and stable retry IDs. Show creation/request choices in their existing places; clicking the ghost must not send a request or start an empty real node.
- Show the same geometry and status in Inquiry, Compare, and Argument. Authoring/responding actions appear in Compare under the current mode grammar; other modes use the neutral display without extra authoring buttons or automatic mode switches. Reserve the same control rectangle regardless of mode so hiding a button does not move nodes.
- Update every obstacle/bounds consumer that currently assumes all placeholders are `CARD_W × CARD_H`, including source routes, discussion/reasoning placement, linked-node reveal, and Fit. Preserve the shared route's visible stroke, hit target, label, arrow direction, and endpoint highlighting.
- Maintain a gap between a node and its ghost without drawing an edge that looks like a saved relationship. Source connectors attach only to real cards. Genuine saved comparison links keep their existing inspected meanings.
- Keep ghost status and actions accessible through the selected node's inspector when zoomed out. Provide visible keyboard focus, explicit accessible labels identifying the source and other map, usable touch controls, Escape/Close behavior, and focus return to the initiating control. Ghost clicks must not initiate panning or propagate into unrelated node actions.
- Preserve draft guards across opening/closing, mode changes, explicit reveal, and linking. Declining discard keeps the draft; cancelling the chooser leaves layout/camera unchanged. Link/withdraw completion may reflow the affected frame, but retain zoom and anchor the initiating node rather than automatically fitting the whole canvas.
- Exclude ghosts from child counts, real-node search, selection IDs, saved coordinates, and data export. Exported portable views should regenerate the same ghosts from real records. Frame headings get no unlinked ghosts.

**Acceptance:** both participants can link from either source, requests remain explicit, all statuses/controls fit at desktop and narrow widths, and the same comparison has identical source geometry across shared modes. Map/Create and ordinary source browsing retain their current behavior.

## 5. Verification and visual review

Extend existing meaningful suites; avoid tests that merely repeat button strings or the implementation algorithm.

| Coverage | Required regressions |
| --- | --- |
| `tests/counterparts.test.mjs` | Separate semantic versus placeable state; withdrawn/request/response precedence; missing and unavailable endpoints with permitted history; multiple meanings counted by actual pair; no saved writes from projection. |
| `tests/comparison-layout.test.mjs` | Equal-order and equal-title maps remain unpaired; unique occupied groups; no vacated-slot growth; valid descendant ancestry; deterministic pair priority and swapped maps; multiple/cross-depth pairs without cycles; cross-frame/hidden links; unchanged sources. |
| `tests/comparison-routing.test.mjs` and `tests/source-routing-browser.test.mjs` | Compact ghost obstacles and true bounds; source edges avoid controls/cards; real endpoint directions and hit targets; five-child screenshot fixture; requests; dense/deep graphs; one route per actual pair. |
| `tests/counterpart-browser.test.mjs` | Initial ghosts from both maps; direct chooser and cancel; two accounts; link/withdraw/reload transitions; no accidental requests; other-author withdrawal denial; multiple/hidden/cross-frame/unavailable states; stale-source rejection and safe retry; focus and touch/narrow controls. |
| `tests/mode-consistency-browser.test.mjs` and interaction browser checks | Same source layout/status across modes; Compare-only authoring; unchanged selection/camera on open/cancel; parked drafts and declined discard; selected-node reveal preserves zoom; ghost clicks do not pan. |
| Existing Map/Create, copy, confidence, account/database, standalone and production checks | No change to source authoring, identities, ownership, account projection or portable behavior; every added client helper, if any, appears in the allowlist and standalone module order. |

Use disposable local two-account fixtures, not production maps. Include the screenshot-11 TA case with unrelated four-child maps: every node starts independently despite the equal counts. Include genuinely linked copies to prove existing pairs remain visible. Test zero, one, four, five, six, eight and unequal counts, specifically five-vs-zero, five-vs-two, and five-vs-eight; alternate which map is collapsed; include narrow windows, cold reload, repeated mode switches, and expansion of a linked descendant. Inspect screenshots of the actual implementation at comparable zoom, including a busy graph where some crossings may remain unavoidable.

Add a concrete regression for two unequal maps where linking the fifth node to the first previously left an unused slot. Pair/withdraw repeatedly and assert layout area does not accumulate phantom space. Check source-data equality separately from view state.

## 6. Documentation and release

Update this plan, `docs/current-argument-workflow.md`, `docs/counterpart-workflow.md`, `docs/interaction-grammar-v4.md`, `docs/user-testing-checklist.md`, and `docs/next-work-plan.md` to match the delivered rules. Replace the current “only saved requests produce placeholders” description with the distinct ghost/request states. Keep Worker 48's evidence as history.

After implementation and focused review, run the complete `scripts/verify.mjs` release runner and record its actual count/result; the baseline 48/48 is not evidence for these new changes. Verify the portable comparison as well as the account browser version. Prefer existing modules; if a new client helper is introduced, register it in `scripts/client-assets.mjs` and `scripts/export-standalone.py` and verify the full module graph.

Follow the established publication sequence when executing the plan: commit reviewed application changes, push `redesign/node-interactions`, pass hosted Release checks on that exact revision, deploy the verified Worker, then verify public assets/account boundaries and record the actual version in `docs/deployment-status.md`. Keep automatic deployment disabled. Retain Worker 48 as the preceding compatible rollback version. No database migration, production account test write, or dependency update is expected.

The owner has authorized execution of this plan. All **48/48 local release checks passed**, including eight browser suites, account/database checks, standalone export and the production build. Report: `build/verification/2026-09-28T22-54-47-000Z-36428/summary.json`; Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows. Hosted verification and publication follow on this exact application revision. Pair-specific **Aligned / In tension** remains the next separate design discussion. The existing deferrals, including manual dragging and broader cross-depth placement refinement, remain outside this increment.
