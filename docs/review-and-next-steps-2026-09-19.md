# Review and next steps — September 19, 2026

Reviewed release source `0b2aa31`, following the disagreement-point/outcome deployment. The findings below describe that release. All five fixes, grouped assessments in Conversations, and searchable shared-map discovery were implemented September 22; see deployment status for final release verification. The original review itself made no application or live-data changes.

## Confirmed issues

### 1. P2 — Changed reference links are hidden during source review

Location: `dist/reflection-ui.mjs:15` (`sourcePreview`), called by the review prompt at line 65.

If a reason's reference URL changes while a point is being written, the source comparison correctly detects a change. However, the old and current previews omit `referenceUrl` and display identical text. The person is asked to confirm a change they cannot inspect. Other tracked source metadata, including ordinary node source references, also needs a rendering check.

Fix: render relevant saved references and changed metadata in the existing old/current preview, with safe links. Reuse the same source rendering for history where practical. Do not add another toolbar or force unchanged metadata into the normal node face.

Acceptance: change only a reason's reference URL and only a source node's reference; the review must show the actual difference, preserve the draft, and retain the original snapshot after acceptance.

### 2. P2 — Withdrawal does not recover from a lost acknowledgment

Location: `dist/reflection-ui.mjs:44` (Withdraw handler).

Each click creates a new save session. When the first withdrawal commits but its response is lost, retrying uses the old version instead of recovering the saved withdrawal. The interface reports that the annotation changed in another window and keeps showing Withdraw. The record is withdrawn correctly; the problem is the misleading failure and blocked recovery.

Fix: retain the withdrawal's operation/session and staged record, and recognize a matching saved version or history entry before version-conflict checks. Do not retry as a new revision or use a broad exception that bypasses ownership/history validation.

Acceptance: lose the response after a successful point withdrawal and after an outcome withdrawal. Retry must show the saved withdrawn state, with one history revision and no false draft/conflict warning. Also test a real competing edit to distinguish it from a lost acknowledgment.

### 3. P2 — Search does not reveal a collapsed source-map edge

Location: `dist/reflection-ui.mjs:32` (`reveal`).

Finding an edge-attached point and selecting **Show on map** opens the note but leaves the actual source edge and its child hidden when their map branch is collapsed. The reveal path expands node targets only; centering can land on the visible ancestor instead.

Fix: reveal both actual edge endpoints and their necessary ancestor paths before positioning the note. Preserve zoom and unrelated branch folds. If a source no longer exists, identify that state rather than implying the original edge was revealed.

Acceptance: search for an annotation on a collapsed structural edge and on an explicit map connection. Both endpoints and the real connection must become visible at the existing zoom. Existing source-node and Supports-connection navigation must continue to work.

### 4. P2 — Find misses visible wording on existing-node reasons

Locations: `dist/reasoning-ui.mjs:75` renders the pinned summary; `dist/reasoning-view.mjs:120–121` builds search text without it.

An existing-node reason card displays the saved position's summary, but searching words from that summary can return no match. Saved details are omitted too.

Fix: search the accessible pinned premise wording already attached to the contribution. Keep live/unpublished source edits and unused definitions out of the search index. No new search controls are needed.

Acceptance: summary-only and details-only matches should return the correct reason. After its source changes, search should continue to reflect the wording the reason actually uses until explicitly reviewed.

### 5. P3 — Library's source-review wording overstates its coverage

Location: `dist/library-summary.mjs:21–25`.

The generic **N need source review** label counts only earlier proposal judgments. A current reason can have `discussionHealth.state === 'changed'` while the Library reports `sourceReviews: 0` and only **1 reason**. Current annotations are likewise outside the count.

Smallest fix: label this existing count **N earlier judgments need source review**. A later current-conversation review summary should explicitly define its scope and avoid counting a changed ancestor repeatedly through all its descendants. Zero should not imply that every source is current.

## Verification and limits

- The release's existing **45/45** result remains recorded at `build/verification/2026-09-19T06-29-39-475Z-75668/summary.json`; the whole suite was not rerun solely for this review.
- The three UI defects above were reproduced in headless Edge with disposable two-account fixtures and the real account-save code. The temporary reproduction is `review/reflection-ui-review.mjs`. Screenshots: `build/design-review/reflection-review-hidden-reference.png`, `reflection-review-withdraw-retry.png`, and `reflection-review-collapsed-edge.png`. These generated artifacts are intentionally ignored by Git.
- Focused reflection model, API and direct PostgreSQL/PGlite suites passed. An additional disposable case confirmed that withdrawn node definitions are excluded consistently from JavaScript/database snapshots and that a subsequently created point is readable by both participants.
- No additional author-permission, privacy, capability-negotiation or history-integrity defect was reproduced in the inspected reflection paths. This is a bounded review, not a claim that every application path is defect-free. No production account session or data was used for the reproductions.
- Existing dependency advisories and the owner's disclosure preference remain in [dependency-review.md](dependency-review.md). No registry audit, dependency installation or live security-configuration change was performed.

## Recommended next sequence

1. **Small stabilization release.** Fix issues 1–5, add the missing targeted regressions, then run the complete release checks. Consolidate source-preview formatting only as needed to make visible wording and source review consistent. Keep the current Compare/Argument boundaries.
2. **One complete two-person exchange.** Use a realistic claim: ask for clarification in Compare; explain a reason; challenge the statement or inference; respond; locate the disagreement; record two potentially different outcomes. Check whether a new tester can identify the target, author and next useful action. A short fictional worked example would help more than another set of controls. This usability exercise need not block the code fixes.
3. **Make outcomes easier to revisit.** Group each point with its separately attributed outcomes and next steps within the existing Conversations view. Sort points by recent activity, retaining stable order inside each exchange. Keep an absent assessment neutral; matching outcome labels do not establish mutual agreement. Preserve search and on-map access. Avoid a new dashboard, permanent toolbar row, unread claims or task-assignment features.
4. **Improve map discovery before adding Compass.** The intended searchable **Find a map** list does not yet exist: current Choose maps uses source dropdowns populated in workspace order (`dist/library-ui.mjs:59`, `dist/workspace-ui.mjs:48`). Build a searchable, predictably sorted list of accessible maps inside Comparisons, identified by map and owner. It becomes Compass's list alternative and keeps unplaced/overlapping maps reachable.
5. **Settle Compass wording, then implement optional self-placement.** Confirm both axes and their endpoint meanings with the owner before storing placements. Retain map-level ownership, optional placement, axis versioning, current sharing rules, and a clearly marked self-placement origin. Do not calculate political labels or rank truth/quality from coordinates or confidence.

Alongside product work, synchronize the reviewed source to GitHub and run the prepared manual **Release checks** workflow on that revision before enabling push/PR checks. Hosted CI has not been established by the local release pass. Revisit the development-tool advisory follow-up with the promised disclosure notice before any further registry audit.

The fixes, outcome grouping and discovery-list foundation do not require a new product decision. Compass axis wording does. Shared-premise acknowledgment and a fully integrated reasoning graph need a separate design pass after the present exchange is tested. Manual dragging, pod authoring/derivation, automatic merging, calculated compass placement and multiple pinned windows remain deferred.

This review follows the [current interaction rules](compare-argument-ui-rules.md), [feature contract](disagreement-points-outcomes.md), and [process-design review](process-design-review-2026-09-19.md). Official platform references were checked during the review: [Cloudflare Workers best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/) and [Supabase changelog](https://supabase.com/changelog). No platform migration was needed for these findings.
