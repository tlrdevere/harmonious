# Compare, Inquiry, and Argument consistency plan

Prepared September 25, 2026, following the code review and disposable browser reproduction. **Implementation status:** steps 1–4 are implemented locally, including shared summaries/counts, search in each mode, consistent attachment navigation, and retirement of older authoring routes. Targeted and browser checks pass; final release verification and publication are tracked in [deployment status](deployment-status.md). Step 5 has a [representative placement study](design/counterpart-depth-study.html); the radial layout remains unchanged. Reviewed source: `41b186fa47fc547a9c03ad76e68d1768757e7123`, on `redesign/node-interactions`.

The [interaction grammar](interaction-grammar-v4.md) remains the product specification. This plan fixes its integration with lists, search, canvas attachments, and historical views. It supersedes conflicting next-work priorities in older plans, not the agreed grammar.

## Intended experience

- Compare, Inquiry, and Argument keep their distinct actions, but share selection, attachment opening, search, list presentation, source navigation, and draft protection.
- A saved interaction has the same title, author, selected choices, response outcomes, and target wherever it is opened.
- Interactions remain attached to their source. Search must not create a second visual representation of a dispute.
- Mode changes preserve the camera, selected source, and expansion state. The source maps retain their common radial comparison layout.
- Existing records remain reachable. Historical compatibility must not expose retired creation workflows in the current modes.

No new interaction categories, resolution model, automatic adoption, dragging, or replacement layout algorithm are included. No database migration is expected; confirm that before implementation.

## 1. Establish shared presentation and counting rules

Create a small shared presentation/query module used by the three modes, Library summaries, and search. Keep display adaptation separate from stored grammar validation. Do not turn every new dispute into a legacy Challenge merely to satisfy old helpers.

It should derive, from an access-filtered workspace:

- originating mode and source anchor;
- action label, author, target label, selected option labels, Other text, and optional comment;
- response outcome and parent interaction;
- accessible reference wording and source availability;
- active versus historical status and deterministic ordering.

**Recommended display rules:**

| Surface | Rule |
| --- | --- |
| Interaction list | Action and author, source label, then a compact preview of selected choices/comment. Show at most two choice labels plus a remaining count; full details open on selection. |
| Response row | Show the actual outcome, such as “Partly accept · Taylor,” rather than “Respond · Taylor.” Include a short optional explanation. |
| Source badge / attached list | Count active initiating interactions, not responses. The list opened by a badge must contain exactly those counted threads. Responses remain nested under their initiating interaction. |
| Library summary | Count active positions, inquiries, and disputes using the same definitions; identify retained counterpart requests and earlier records accurately. Responses affect recent activity but do not count as new initiating interactions. |
| Ordering | Conversation threads ordered by latest activity, with a stable ID tie-breaker; responses chronological within each thread. |
| Withdrawn history | Exclude withdrawn initiators from active counts; retain an unobtrusive history path to them and their responses. Do not lose an active response because its initiating record was withdrawn. |

Derive option labels from the record's saved classification, not the source's current frame or citation state. A later source edit must not erase the meaning of an earlier selected ground. Internal Signals tags remain absent from display and search. Unknown historical labels should have a readable fallback, without rewriting records. Reply ancestry and privacy rules determine mode and accessible source context.

Primary files: `dist/interaction-ui.mjs`, `dist/discussion-ui.mjs`, `dist/library-summary.mjs`, and a shared helper. Tests: grammar-only, history-only, and mixed fixtures; empty-body disputes; multiple grounds; Other; every response outcome; withdrawal; inaccessible references.

**Done when:** list previews communicate the interaction without opening it, and badges, resulting lists, and summaries agree on what is being counted.

## 2. Use one opening path for attachments, lists, and search

Route all modern entry points through one interaction-opening operation:

1. Resolve the real source and originating mode.
2. Apply existing draft safeguards before replacing a form.
3. Reveal the source branch if needed, preserving unrelated folds and zoom.
4. Pan only as needed, then open the same interaction detail and, when applicable, its selected response.
5. Restore sensible keyboard focus when closed.

Fix mixed-record attachment routing: a legacy reason badge must open its reasons even if a new dispute shares the source. Preserve the clicked badge category, deduplicate threads aggregated under collapsed branches, and include compatible historical records in the appropriate list. The expanded state announced to assistive technology must match the visible attachment view.

New interactions must never enter the older reasoning-card projection as generic Context cards. Historical graph records can retain their historical display behind an explicit history path. Avoid mounting the old argument navigation toolbar for modern interactions.

Primary files: `dist/discussion-ui.mjs`, `dist/interaction-ui.mjs`, `dist/reasoning-ui.mjs`, `dist/reasoning-view.mjs`.

**Done when:** opening the same dispute through its badge, Conversations, or search produces equivalent details at the same source; no extra graph card is created. Tests cover node and edge targets, collapsed branches, mixed records, keyboard operation, and parked drafts.

## 3. Make search consistent across modes

Provide one compact **Find** entry point in the existing controls, scoped to the selected mode and comparison. Reuse the same search panel; do not add another permanent toolbar row or sidebar. Keep a query per mode and show the active scope clearly.

Index accessible action labels, selected option labels, Other text, comments, authors, source labels, response outcomes, and saved referenced wording. Search replies as well as initiators; a matching reply opens its parent thread with that reply identified. Refresh the index when records or access change. Never search hidden Signals or expose a reference that the server has redacted.

Retire the misleading **Open challenges** filter in the current interface. Recommended Argument filters are **All** and **Disputes**, where Disputes identifies initiating disputes, not a new unresolved/resolved status. Accept, Reject, or Partly accept must not imply closure. Historical challenge types can be labeled accurately in historical results without changing their stored meaning.

Use the opening path from step 2 for every result. Keep pagination/bounded results and stable ordering for long conversations.

Primary files: `dist/reasoning-ui.mjs`, `dist/reasoning-view.mjs`, shared presentation/query helpers, and relevant styles.

**Done when:** a dispute saved with no comment is found by its grounds; Other text and response outcomes are searchable; results have correct labels; all three modes offer the same search behavior while respecting their action boundaries.

## 4. Close retired authoring routes and update guidance

Audit controls reached from old records, inference/Supports connections, Earlier records, search, and deep links. Remove old generic Reply/Challenge, Add supporting reason, Resolve/Reopen, standalone adoption, and reflection/outcome creation from the current workflow. Historical detail remains readable; retain authorized withdrawal where supported. An old record must not silently manufacture a modern replacement with a different target or meaning.

Do not remove retained workflows merely because their storage predates v4: counterpart requests and their create/choose fulfillment, confidence, central definitions/standards, source inspection, and reviewed map application remain available under their existing rules. Keep server validation and readers needed for existing records; this is not a bulk data conversion or deletion.

Update current workflow documentation and the two-account checklist around the actual grammar. Mark superseded instructions as historical so retired features are not presented as pending acceptance tasks.

Primary files: `dist/discussion-ui.mjs`, `dist/reasoning-ui.mjs`, historical entry points, `docs/current-argument-workflow.md`, `docs/user-testing-checklist.md`, `docs/interaction-grammar-v4.md`.

**Done when:** every creation path in the current interface follows the agreed grammar or an explicitly retained workflow, while old content and response history remain reachable.

## 5. Investigate and refine counterpart placement separately

The review established that `layout.mjs`, `comparison-layout.mjs`, and `compare-canvas.mjs` are unchanged from the protected stable version. Sparse branches can look vertical, counterpart slots can distort apparent depth, and historical argument rows were never radial. The particular live map behind the owner's observation has not yet been diagnosed.

First reproduce the issue using the affected map if available, or clearly identified representative fixtures:

- one, two, and several children per frame;
- deep and uneven branches;
- counterparts at matching and different depths;
- an occupied counterpart slot and a reserved empty counterpart;
- collapsed descendants, frame filtering, swapped map sides, and narrow screens.

Capture before/after geometry and screenshots. Verify that switching Compare → Inquiry → Argument, without another action, leaves source coordinates, zoom, and expansion unchanged. Separate changes caused by mode switching, source edits, expansion, and explicit counterpart assignment.

Keep the radial solver and shared source layout. Investigate a minimal adjustment to counterpart displacement that preserves branch context and avoids unrelated-node jumps. Evaluate descendants together when moving a counterpart, without changing actual parent links. Preserve empty counterpart affordances and one visible edge per node pair; do not create placeholder nodes in saved maps.

If fixing the concrete issue requires choosing between keeping a pair adjacent and keeping both branch structures intact, present the smallest visual comparison and recommendation before adopting a new placement policy. Routine corrections that preserve the agreed behavior do not need a new layout redesign.

Primary files: `dist/layout.mjs`, `dist/comparison-layout.mjs`, `dist/compare-canvas.mjs`, routing helpers. Extend `tests/layout.test.mjs`, `tests/comparison-layout.test.mjs`, and `tests/comparison-routing.test.mjs` as needed.

**Done when:** the reported behavior has an evidenced explanation; any chosen fix retains radial context, independent authorship, readable routes, no card overlaps, unchanged source data, and identical base positions across modes. Do not claim the live example is fixed using only a generic fixture.

## 6. Verify and release in two increments

Implement steps 1–4 as the consistency release. Keep step 5 in a separate change so layout investigation cannot obscure regressions in interaction behavior or delay the core fixes unnecessarily.

Before implementation, record the current v4-compatible source and live deployment as the return point. Leave `stable-before-interaction-redesign` fixed. That older tag is historical protection, not a safe blind production rollback after v4 records have been saved.

For each increment:

1. Add targeted regression coverage for the observed failure, then run affected suites.
2. Add an active `tests/mode-consistency-browser.test.mjs` suite to `test:browser` and the release checks; do not rely on retired reasoning-browser suites. Use two disposable accounts and the real account authorization layer.
3. Verify desktop and narrow-screen presentation, keyboard focus, count/list parity, correct response outcomes, recipient restrictions, mode boundaries, persistence after reload, and privacy after sharing changes.
4. Run the aggregate release verification and Worker build on the final source. Record actual results; the previous 44-check pass does not cover these new cases.
5. Once implementation is authorized and release checks pass, use the established live-beta deployment process within the owner's deployment authorization. Confirm deployed assets, core navigation, and the updated walkthrough. Document any portion still awaiting owner usability testing.

This increment has no database migration or stored-data rewrite. Deployment follows final release checks.

## Implementation order and decisions

Dependencies: shared presentation rules → consistent opening/counts → mode search → historical controls and guidance → verification. Historical-control inventory can run alongside the shared helper work; layout diagnosis can run separately without editing the same UI files.

The proposed display/count rules, compact Find control, and replacement of Open challenges are recommendations in this plan. They require no new interaction taxonomy or termination semantics. The owner authorized implementation with “Continue.” A different overall layout policy remains a separate design decision if the investigation demonstrates that one is necessary.
