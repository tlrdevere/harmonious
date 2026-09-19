# Next features: readable arguments and controlled adoption

Planned September 18, 2026 (New York), following the Argument release at local commit `5ee06d7`. **This document describes proposed work, not live features.** The live behavior is documented in [the current workflow](current-argument-workflow.md) and [deployment status](deployment-status.md).

## Recommended sequence

| Order | Deliverable | What it improves |
| --- | --- | --- |
| 1 | Fold individual follow-up branches | Read one exchange without losing sight of other discussion. |
| 2 | Find and focus any contribution | Reach a specific challenge or response even in an argument larger than the display limit. |
| 3 | Fulfill an adoption suggestion | Let the recipient deliberately add or identify their own node, with clear authorship and history. |
| Alongside these | Repeatable release checks and CI preparation | Make the next releases easier to verify without expanding the product interface. |

Build and release the first two together as the next usability increment, then release adoption separately because it changes saved records and writes to a worldview. The owner's [two-account walkthrough](user-testing-checklist.md) can refine labels and spacing; it is not a prerequisite for doing the implementation preparation.

[Open the clickable design preview](design/argument-next-features.html). It uses invented examples and illustrates the proposed controls; it is not connected to accounts and is not an implementation or a performance test.

## 1. Fold follow-ups where they are attached

Add a small footer control to a card only when it has follow-ups: **Hide follow-ups** when expanded, or **Show 5 follow-ups** when collapsed. Beside a collapsed control, show a quiet **2 open challenges** indicator when applicable. Count hidden active reason, challenge and response cards once each; resolved challenges remain in the total but do not count as open. Exclude decorative connections, resolution/reopen events and context-only or withdrawn historical placeholders. Existing standalone inquiry counters retain their own behavior. Distinguish deliberately folded follow-ups from cards omitted only by the display budget.

Keep the original card visible. Collapsing changes what is drawn, not the conversation, its outcome or anyone's worldview. The other participant's view is independent.

Preserve the distinction between a statement and its inference:

- A reason's footer controls contributions to the reason's statement, including supporting reasons and their descendants.
- Its **Supports** marker has a separate challenge indicator for contributions targeting that reasoning connection.
- Collapsing statement follow-ups does not silently collapse the inference discussion.
- If an earlier ancestor hides the whole reason, its statement and inference discussions are included in that ancestor's hidden count, once each.

Re-expanding restores internal folds instead of opening every nested response. New saved responses update counts after the normal refresh without reopening a branch. Withdrawn ancestors remain clearly historical wherever needed to explain an active descendant.

Keep the clicked card at the same screen location and preserve zoom while recalculating the layout. Only an explicit **Fit argument** changes zoom. Preserve folds while switching modes or revisiting a comparison during the same page session; a browser reload may start from the default view. Clear private view state on sign-out/account reset or loss of map access.

An unfinished composer must retain its text, reference, chosen definitions and exact target. Folding another branch is allowed. If the chosen fold would hide the edited contribution or its required context, keep that path visible until the form is finished or explicitly discarded. A display-only action must not invoke a discard routine automatically.

**Acceptance:** independently fold a statement challenge and an inference challenge; receive a response while folded; switch modes during a draft; collapse a source-map branch; navigate by keyboard and at a narrow width. Counts, target identity, screen position and both users' independent views must remain correct.

## 2. Find a contribution without opening everything

Add **Find in argument** within the existing on-canvas tools. It opens a compact overlay with a search field and two initial filters: **All** and **Open challenges**. Search the currently accessible contributions in the selected Comparison, across all source groups, including responses. Do not add another permanent header row or require a side panel.

Each result shows a short excerpt, author, contribution type, outcome when relevant, and what it addresses. For a challenge, distinguish **Position**, **Reason statement**, **Reasoning connection**, and **Response**. Use **Show on map** to reveal that contribution and its immediate context. Keep **Browse all … contributions** as an accurate label for the complete list, replacing the current misleading “Show all” wording that only opens a list.

Keep the 40-card drawing budget. Required historical/context cards count toward it; **Earlier steps** navigation controls do not. If expanding a fold exceeds the available budget, show a labeled continuation for the remaining cards rather than silently dropping some of the promised follow-ups. Search and the complete list must operate on all accessible records, not only the 40 currently drawn. Opening a result should unfold only the path necessary to reach it. If there is an unfinished composer, preserve it or use the existing explicit discard decision before replacing it; typing in search alone must not replace the form.

For an ordinary-sized chain, display the selected contribution with its actual ancestry. For a chain longer than the budget, display a contiguous section around the selection and expose **Earlier steps · 28** as a navigation control. It must look different from an authored card. Do not draw a support line that skips omitted steps or silently attach the selected contribution to the original worldview instead of its real target.

For an inference challenge, its reason, immediate conclusion, support connection and challenge form one required display group. Keep both endpoints visible or label a genuinely missing/withdrawn endpoint; never substitute an unrelated visible ancestor. Offer **Back to selected contribution** after inspecting earlier steps, alongside the existing **Back to source**. Reserve **Earlier reasoning** for the existing legacy-argument destination.

Make finding a result a deliberate reveal/pan action at the current zoom. Avoid zooming out until text becomes unreadable. If the context cannot fit, leave the remainder reachable by pan and **Fit argument**. Within the budget, prefer the chosen chain and nearby follow-ups over unrelated siblings.

**Acceptance:** find a response 80 steps deep and an inference challenge near the display boundary; search a group with 200 siblings; include withdrawn context without misleading active status; preserve drafts; remove results and view state promptly after access is revoked. Every result must be reachable, regardless of the rendering limit.

## 3. Fulfill an adoption suggestion

The recipient opens the existing suggestion on the map and chooses **Add to my map**, **Use an existing node**, or **Not now**. A general **Respond** remains available for discussing the suggestion. The suggester can never perform these actions for the recipient. This flow requires a different recipient; comparing two maps owned by the same person should not manufacture a suggestion to oneself.

For **Add to my map**, show a short preview with editable wording and a parent picker in the recipient's map already used by this Comparison. The destination remains visible throughout. The final action explicitly creates one independent node owned by the recipient. Preserve source attribution and the exact wording/version used; later edits to either person's node do not update the other automatically.

For **Use an existing node**, show the recipient's ordinary nodes with their parent paths and wording. Selecting one records the recipient's decision without overwriting its content. Neither route creates a co-sign or an agreement/disagreement judgment.

Offer **Link as counterparts** as an optional, initially unchecked choice. Reuse an existing link when applicable. A neutral counterpart connection is separate from adopting the idea; an agreement remains a separate user action. The canvas still draws one visible line for the pair with saved meanings accessible through it.

Only one node is in scope: no frame headings, bulk branches, private destination-map picker or copying of the source's conversations. Allow the recipient to put the new node under a chosen parent in their comparison map, including another frame; identify that choice clearly and preserve attribution rather than rewriting either source hierarchy.

If the source invokes definitions or standards, put them under a collapsed **Definitions used by Alice** section. Display only exact versions already shared through that node. An initially unchecked **Copy to my library and use here** option imports a selected definition into the recipient's library, attributes its origin and explicitly invokes the recipient's copy on the new node. Otherwise the original definition remains part of the source context, not a definition the recipient has chosen. This preserves the central-library design without making adoption depend on creating definitions first. For **Use an existing node**, preserve that node's definition invocations as well as its text; definition changes belong to its normal editing flow.

Suggested outcomes are **Awaiting response**, **Not now**, **Added to my map**, and **Used an existing node**, with the recipient's name. “Not now” can be reconsidered later. Withdrawing the suggestion blocks new fulfillment but does not delete an already-created node or erase the recipient's receipt. Show **Suggestion withdrawn** alongside that history when necessary. Editing or deleting an adopted node later remains a separate map action; its receipt can show **Changed since adding** or **Removed from map**.

After fulfillment, show **Open node**, not another Add button. Do not offer a generic “Withdraw” on a fulfillment receipt that appears to undo the map edit. A general reply can explain a changed decision. Re-adopting after deleting a copy is outside this first increment.

If the source changes during the preview, retain the recipient's draft and show the difference before saving. Require an explicit review of the changed source/version; do not silently replace drafted wording or copy new definitions. Loss of source access or withdrawal of the suggestion prevents a new fulfillment. It does not retroactively remove an independent copy already saved by its owner.

**Acceptance:** try new and existing nodes, edited wording, both choices for counterpart linking, optional definition imports, both participant roles, a changed source, withdrawn suggestion, deletion of an adopted node, concurrent tabs and an interrupted save. No route should modify someone else's map, imply agreement, duplicate a copy or expose unused private definitions.

## Implementation boundaries

### Display projection and navigation

- Build one reusable index of contributions, typed targets, children and outcome events per refresh. The existing tree orders `entry` and `inference` children by the same parent ID; independent folds need typed keys so those two targets do not become indistinguishable.
- Extend `conversation-tree.mjs` or extract a small projection module for visible cards, hidden counts, required context and bounded sections. Keep it pure and test it without a browser.
- Keep personal view state separate from authored records, keyed by account, Comparison and source group. Store IDs and display state, not private wording. No database migration is expected for the first two features.
- Extend `reasoning-ui.mjs` and `reasoning.css` for fold controls, search and navigation. Preserve the existing draft boundary in `discussion-ui.mjs` and reset logic in `account-ui.mjs`.
- Keep placement and routing separate: `reasoning-layout.mjs` currently routes connections; automatic card placement still lives in `ReasoningUI.position()`. Extract placement if needed for stable anchored folding, rather than overloading the router.
- Address the existing `focusOmitted` result from `selectReasoningEntries()`: currently the renderer ignores it when a selected chain exceeds 40 ancestors. Add the bounded-section behavior before claiming every search result can be displayed.
- Test geometry and count computation on dense synthetic fixtures. Avoid rescanning the full discussion set for every card/outcome or recomputing routes just because the camera pans.

### Adoption records and atomic saves

- Add a small adoption-fulfillment model/UI module. Reuse counterpart destination-picker and staged-save patterns where appropriate. Keep `discussion-ui.mjs` as the entry point rather than expanding it into another large controller.
- Reuse independent-copy provenance from `adoption.mjs`, not `endorseNodes()`, which creates a co-sign. The existing `transferNodes()` helper restricts destinations to the same frame; support the chosen cross-frame destination through a carefully scoped helper rather than weakening unrelated legacy copy behavior.
- Add adoption-specific reply/outcome actions and immutable fulfillment metadata. Do not overload challenge `accept`, counterpart outcomes or an agreement record. Capture suggestion ID/version, recipient, source node and exact reviewed idea version/wording, destination node, and any optional counterpart link.
- Capture a dedicated, bounded adoption source snapshot. Current node-source snapshots retain invoked context text but not every structured library-version reference. Record exact invoked references for provenance; never include uninvoked library entries or later private versions.
- Selected definition imports become recipient-owned entries with attributed origin and recipient-authored version-1 invocations. Reuse a previous import only when source identity, source version and exact wording match. Never deduplicate by title. Preserve older free-text context as text; do not invent structured entries by parsing it. Existing-node fulfillment does not import or change definitions.
- Prepare and save the new node/idea, selected definition imports and context, optional correspondence, and fulfillment receipt in one atomic account transaction. A failed ownership, source-version, destination revision or map-size check must save none of them and leave the draft recoverable.
- Use one stable fulfillment identity per suggestion and recipient, checked by Worker and database validation. Repeated clicks, two tabs, retries and a lost response must resolve to the existing receipt instead of creating another node. Reconcile an uncertain save before rebuilding the operation. No automatic retry should reuse a now-stale source or overwrite concurrent map edits.
- Require the recipient to own the destination map in this Comparison; both maps and the suggestion must remain available at save time. Ordinary node/parent validation still applies. A request cannot name a foreign/private destination or reuse a receipt from another thread.
- Plan an additive conversation/definition validation migration, a dedicated adoption capability (for example `comparison-adoption-v1`) and portable schema version 4. These guard new outcomes and import provenance from incompatible clients. Confirm the exact shape during implementation, retain readers for earlier versions, and preserve old suggestions/co-sign records without redefining their meaning. No new public table or broader grants are expected.
- When source access is later removed, comparison discussion follows the existing visibility boundary. A recipient's already-owned copy and its attributed historical provenance remain theirs; no new source wording or private definitions may become visible through that provenance.

### Release checks

Create one repeatable local verification entry point covering application/account scripts, disposable PostgreSQL fixtures, the four browser walkthroughs, portable export/reopen, production build and built-asset/security checks. Current `verify` omits browser and portable checks; make the distinction explicit until the aggregate entry point exists.

Prepare hosted CI using those same checks with read-only repository permissions and disposable data. It should require no production credentials and should not deploy on a push. Browser tests currently require `HARMONIOUS_PLAYWRIGHT` and default to local Edge; provide an explicit portable test-runtime setup and a pinned browser dependency when implementing CI, rather than hard-coding this PC's path. Keep failure screenshots/logs as diagnostic artifacts. Validate a clean checkout before enabling the hosted run; source synchronization to GitHub is a separate step from editing a workflow locally.

Keep the dependency follow-up separate from feature changes. Revisit the existing [software-inventory disclosure preference](dependency-review.md) before another registry audit. This planning pass does not update packages, query advisory services, apply migrations or deploy a site.

## Ready-to-release checkpoints

| Increment | Required evidence |
| --- | --- |
| Folding + navigation | Pure projection/geometry checks; two-account browser coverage of independent folds, deep chains, inference targets, drafts and access loss; readable desktop/narrow screenshots; unchanged authored data. |
| Adoption | Author/recipient permission and history tests; direct database rejection of forged fulfillment; atomic create/link/outcome behavior; duplicate retry protection; two-account save/reload and privacy checks; earlier records and portable compatibility. |
| Every release | Existing comparison/counterpart regressions, all local release checks, documented version and public asset verification. Owner usability feedback is recorded separately from automated pass/fail results. |

## Defaults and deferred work

The defaults above let implementation proceed without another design decision: personal folds, one compact search overlay, optional counterpart linking, independent adopted nodes and no automatic agreement. Labels and spacing can change after the owner tries the preview.

Keep manual dragging/rearrangement, pods, automatic merging, arbitrary cross-links, reuse of one reason for multiple conclusions, multiple pinned windows, live notifications and saving unfinished forms across reloads on the later list. Formal premise bundles and new Argument categories are also outside this next increment. The next goal is to make the existing reasoning workflow easier to read and act on.
