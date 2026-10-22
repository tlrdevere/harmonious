# Optional off-canvas view — implementation plan

Requested October 21, 2026. **Status: planned, not implemented.** Baseline: Worker 70, followed by the completed development-tool maintenance pass with 68 passing local and hosted checks. Retain the existing technology stack and all existing desktop features.

## Outcome and boundaries

Add a **Canvas / Outline** presentation switch. Outline lets people read and contribute using ordinary scrolling pages, lists and forms. It is available on desktop as well as mobile. It presents the same saved maps, comparisons, arguments, Philosophy references and assessments; it does not introduce a second copy of the data or a separate discussion system.

Desktop continues to open Canvas by default. A first visit on a narrow screen may default to Outline; an explicit choice takes precedence thereafter. Resizing or rotating a device must never change the selected presentation or discard work. Canvas remains available on phones. No existing desktop menu, action, connection tool, spatial behavior or account feature is removed or made Outline-only.

The existing Create, Inquiry, Compare and Argument meanings remain unchanged. Canvas/Outline is a presentation choice within the current context, not another interaction mode. Future authored pods, public/private pod permissions, notifications, sign-in cleanup and operational backups are separate increments, recorded in [testing-readiness follow-ups](testing-readiness-followups.md).

## Experience

### Worldview and source maps

- Show Status Quo, Transformative Action and Goal State as named sections, with expandable topics and child lists. A selected node opens its full wording, confidence, Philosophy, parent context, sources and available actions.
- Use breadcrumbs and a limited amount of indentation. Deep branches open into a focused page with a clear parent/back action instead of accumulating horizontal scrolling.
- Owners can add a child and immediately edit it, edit existing nodes, set or clear confidence, manage eligible connections, use Philosophy and delete branches through the existing commands and confirmation rules.
- Show connections as labeled links identifying both endpoints and direction. Cross-frame connections, reasons and other supported meanings remain accessible without requiring a line on a canvas. Distinguish parent structure, source relationships and counterparts.
- Preserve map creation, settings, visibility, copying, deletion, search, expansion controls, source browsing and all currently available co-sign/copy actions. Source maps remain read-only where they are read-only today.
- Provide a text equivalent of topic focus: selected branches and their connected first-tier topics remain in scope; clearly indicate excluded content and offer Clear focus. Do not change saved topology or silently discard a hidden selection.

### Comparisons

- Show a list of explicit counterpart pairs and unmatched nodes, with frame/topic filters and search. On a phone, stack both participants' cards within a clearly labeled pair. Desktop Outline can use two readable columns when space permits.
- Preserve both full original wordings, owners, personal assessments, mutual agreement/disagreement/asymmetry, confidence and source-review indicators. Visual joining never becomes an automatic data merge.
- Show each node's own parent breadcrumb. Pairing nodes does not imply matching hierarchy. An unmatched node has a neutral status/action area; do not invent a counterpart, agreement, request or relationship based on list adjacency.
- Retain same-frame one-to-one linking, unlink permissions, requests and request-only counterpart creation. Preserve access to older records without rewriting them to fit the current one-to-one rule.
- Inquiry, Compare and Argument continue to expose their existing eligible actions on nodes and connections. Mode changes preserve the comparison and relevant selection.

### Argument and dialogue

- Selecting a disputed node immediately shows its dispute list, counts and current states, with an action to begin another eligible dispute.
- Opening a dispute shows the full challenged text, its four-category classification, explanation/reference and replies. Each reply identifies its actual target; a chronological list must not imply a reply chain that was never recorded.
- Preserve reply, edit/withdraw, source-review, history, references, facilitation attribution and standstill actions, with the same eligibility as Canvas.
- Provide a focused dialogue page as the Outline equivalent of the inner Argument canvas, with a return to the outer comparison and the selected source.
- Above/below/side reply placement remains supported through an optional **Placement in canvas** choice in the reply form. Outline labels the reply target and does not invent semantic differences from spatial placement. Existing placement is retained when editing in either presentation.
- Preserve the existing Find/filter controls and make matches open the exact authorized node, connection, dispute or reply.

### Existing derived pods and other destinations

The current derived-pod prototype retains its population/threshold selection and context-only labels. Outline can list the same resulting nodes and counts. It must not represent this prototype as the new authored/public/private pod system. Map Library, the Philosophy bank and account/settings pages remain available in both presentations.

## Shared behavior and implementation

1. **Inventory and shared commands.** Create a feature/action parity matrix before UI changes. Use the existing eligibility, validation and write paths. Where commands currently require canvas coordinates or DOM anchors, separate the action from its presentation host. Avoid a parallel implementation of ownership, linking, confidence, disputes or standstill rules.
2. **Read projections.** Add a small pure projection module for frame/topic lists, explicit pairs, unmatched nodes, labeled connections and reply targets. Stable IDs drive selection, not titles or row positions. Consume only the workspace already authorized by the server. Do not fetch hidden maps merely to fill in a row or breadcrumb.
3. **Presentation state and routing.** Introduce a shared presentation controller and Outline host. Add a separate route parameter such as `layout=outline`; preserve the existing `view` parameter's meaning for Compare/Argument. Old links continue working. Retain map/comparison/node/dispute/reply IDs when switching, and keep Back/Forward and reload coherent.
4. **Preserve each view's navigation.** Cache Canvas camera, folds, selection and focus independently from Outline expansion, scroll and focused row. Returning to Canvas restores its previous position rather than fitting or rearranging the map. A direct link to a hidden item can reveal its ancestors without changing source data.
5. **One active editor.** Reuse the existing form/controllers and save commands. If a form can move between hosts without losing state, preserve its exact draft and caret. Otherwise use the existing leave guard and keep the current presentation until Save, Cancel or confirmed discard. Never mount two editable copies, attach duplicate listeners or trigger a second write while switching.
6. **Responsive styling and accessibility.** Use ordinary document flow and vertical scrolling. Full text, error/status messages and save controls remain readable with large text, on narrow phones and with the virtual keyboard open. Buttons work with keyboard and touch, sections use appropriate headings/disclosure semantics, and opening/closing details restores focus predictably. Use explicit Back controls rather than depending on blank-canvas clicks.
7. **Packaging.** Register new modules/styles in the existing asset manifest, independent Worker build and standalone exporter. Proposed files: `outline-projection.mjs`, `outline-ui.mjs`, `presentation-ui.mjs` and `outline.css`; adapt to the existing module boundaries during implementation. No framework or database migration is expected for presentation alone.

Relevant integration points include `app.mjs`, `library-ui.mjs`, `node-actions.mjs`, `node-face-editor.mjs`, `map-connections-ui.mjs`, `participation-ui.mjs`, `discussion-ui.mjs`, `interaction-ui.mjs`, `argument-dialogue-ui.mjs` and the existing model modules. Reuse the current action grammar rather than exposing previously retired/deferred controls.

## Delivery order

1. Action inventory, projections, switch, route/state handling and read-only map outline.
2. Complete owner map authoring, confidence, Philosophy, connections and source browsing in Outline.
3. Pair/unmatched comparison lists and complete Inquiry/Compare action parity.
4. Dispute log and focused dialogue Outline, including all reply and standstill operations.
5. Derived-pod presentation, account/facilitator/portable parity, accessibility and regression review.
6. Full local and hosted verification, visual review at desktop and phone sizes, then publication and exact live verification using the established release workflow.

Do not release an incomplete Outline as though it supports the whole workflow. Internal stages can be tested separately; the public option should meet the parity criteria below.

## Acceptance and verification

| Area | Required evidence |
| --- | --- |
| Desktop preservation | Every existing Canvas feature remains available; existing automated checks pass unchanged except justified shared presentation selectors. No layout/connection/zoom/focus regressions. |
| Data identity | Actions in either presentation modify the same records; changing views alone makes no save or data mutation. |
| Map authoring | Create/edit/cancel, immediate child editing, confidence null/0/100, Philosophy reuse/versioning, links, copy and deletion work in Outline with existing rules. |
| Comparison meaning | Explicit pairs, unmatched nodes, different branch depths, legacy records, assessments and source-review states remain truthful. |
| Argument parity | All four dispute categories, connection targets, repeated/branched replies, placement preservation, histories and standstill operate through the same commands. |
| Navigation and drafts | Back/Forward/reload, old links, exact-target links, presentation changes, resize and device rotation preserve context and respect unfinished work. |
| Privacy | Two-account tests cover private/unavailable/deleted sources and withdrawn access. No hidden wording leaks through list labels, counts, search or breadcrumbs. |
| Facilitation | Represented identity, grant scope, private drafts, approvals and recorder attribution remain identical to current behavior. |
| Mobile/accessibility | Review 320–390 px widths, enlarged text, long content, deep branches, touch, keyboard/focus and virtual-keyboard use; ordinary content requires no sideways panning. |
| Persistence | Failed saves, retries, stale revisions and refresh never duplicate contributions or lose drafts. |
| Performance | Render manageable branches/lists instead of all nodes and replies at once; test existing large/deep fixtures while retaining accessible search and navigation. |
| Packaging | Both hosted and standalone builds include the new presentation; the existing full suite plus focused new checks pass locally and on GitHub. |

Complete the parity matrix against actual controls during implementation, not just this summary. If an operation is inherently spatial, retain it in Canvas and provide its equivalent semantic command or an explicit placement control in Outline. Desktop users must never have to switch views to regain a feature they already had.
