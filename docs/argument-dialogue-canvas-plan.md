# Node-focused dialogue canvas in Argument

The [reply-placement increment](argument-reply-placement.md) extends this canvas with above/below replies and measured multi-direction spacing. Existing dialogue semantics remain unchanged; see [deployment status](deployment-status.md) for its release.

Implemented and published September 29, 2026 as **Worker 58**, after all **55 local and 55 hosted checks**, the additive database migration and live verification. Source: `b58c121405f9fdd8a40d54706516a58b0d5fd089`. Baseline: Worker 57, with continuing replies and the direct node dispute log. See [deployment status](deployment-status.md).

## Purpose and scope

Let a participant enter an ordinary source node from Argument mode and explore its disputes and replies on a dedicated canvas. The existing comparison canvas remains the overview; the node canvas provides room for a branching dialogue.

Keep the current technology stack and the four dispute categories: Factual basis, Reasoning, Consequences and Feasibility. The log and canvas read and write the same discussion records. No separate conversation copies, resolution system, automatic agreement, new argument categories, arbitrary connection tools or manual node dragging are introduced. Existing deferrals remain unchanged.

This first version covers disputes attached directly to one ordinary node in one comparison. The same node in another comparison has a different discussion scope. Typed-connection disputes retain their existing log and controls; expanding this view to connections is separate work. A linked counterpart does not automatically combine the two nodes' discussions.

## Intended experience

1. In Argument, select an ordinary node and choose **Open argument canvas** near its Disputes log. This works even when no dispute exists. Both participants may open either accessible source node; starting a dispute still follows the current rule of addressing the other person's eligible node.
2. Replace the comparison surface with a dedicated dialogue canvas while keeping Argument selected. A header identifies the comparison, source node and author, with **Back to comparison**, **Fit dialogue**, and an option to read the chronological log.
3. Show the original claim as the root card. Its title, author, frame and full description are available without returning to the comparison. Longer source details and citations can expand on this card.
4. Show each dispute as a separate branch. Cards identify author, date, selected categories and explanation. A dispute with several categories remains one card; do not duplicate it into category branches. A category-only dispute remains valid and readable.
5. Place the initial recipient response and later replies beneath the contribution each explicitly addresses. Multiple replies to one contribution form sibling branches. A connection means **Responds to**; the claim-to-dispute connection means **Disputes**. Neither means supports, refutes, agreement or resolution.
6. Selecting **Reply** on a contribution opens a composer attached to that card and focuses its message field. Clearly show **Replying to [author / contribution preview]**. Require message text, retain the optional node reference, and submit explicitly. Sending adds the card and reveals it without fitting the whole canvas automatically.
7. Keep the first recipient **Respond** flow and its outcome choices. Once that response exists, the regular **Reply** flow continues. Either participant may add follow-ups, including another contribution without waiting for the other person.
8. The chronological log remains available in this view and through the original node window. Targeted replies show a **Replying to** reference; selecting that reference reveals the addressed card. Edits, withdrawals and new messages update both presentations.
9. **Back to comparison** restores the comparison's pan, zoom, frame filter, folds and selected source. Within the page session, re-entering a node restores its own dialogue camera and branch folds. Reload restores the dialogue identity and selected contribution through the URL; it need not persist every camera position across sessions.

A withdrawn contribution retains a labeled historical card when it has descendants, so its replies do not become orphaned or move to a different parent. Preserve access to its authorized history. Do not allow new replies to a withdrawn contribution or a withdrawn dispute. Withdrawal must not delete descendants.

## Layout and interaction

Use a rooted tree growing left to right: claim, disputes, responses and deeper replies. Keep chronological order among siblings, using the existing timestamp and ID tie-breaker. Separate dispute branches by their measured subtree bounds.

Allocate enough horizontal and vertical space for measured card sizes and straight parent-to-child connections. Expand the occupied canvas instead of squeezing cards or routing ordinary dialogue edges around them. This is a dialogue-specific layout; it does not change comparison or source-map placement.

Show readable previews on cards and the full contribution in an expanded card/detail. Measure expanded content before layout, preserve the selected card's screen position when possible, and retain the camera on refresh. Do not let long messages overlap neighboring cards. Author labels and response/outcome text remain visible; colors supplement text rather than carry meaning alone.

Provide pan, zoom, Fit dialogue and branch expand/collapse. Collapsed counts account for all hidden descendants, and selecting a search/log result reveals its ancestors. Do not impose a silent depth or response-count cutoff. If batching becomes necessary for rendering, make remaining content explicitly reachable and distinguish it from an empty branch.

Reuse the proven blank-canvas pan and text-selection protections. Text selection and scrolling inside open details/editors must remain usable. Blank clicks close transient details through existing draft safeguards; they do not leave the dialogue. Keyboard navigation, visible focus, Escape handling and narrow-screen controls must work.

## Implementation sequence

### 1. Add explicit reply targeting while retaining dispute membership

Current version-6 replies point directly to the original dispute. Keep that canonical root target so existing conversation grouping, participant permissions, source anchoring and flat logs continue to work.

Introduce a versioned continuation format, expected grammar version **7**, adding a validated reply-to reference identifying a contribution and the revision being addressed. A new continuation targets either its original dispute or an existing response belonging to that dispute. Keep the root target, reply-to identity and addressed revision immutable after creation; editing changes message/reference content and preserves history.

The receiver remains the other dispute participant, even when someone follows up on their own contribution. Derive permission and recipient from the dispute participants, not from the addressed card's author.

Validate in JavaScript, Worker checks and PostgreSQL that the addressed contribution exists, belongs to the same dispute and comparison, is visible and active at submission, and has the revision the author reviewed. Reject nonexistent, cross-dispute, cross-comparison, self-referential and cyclic targets, fabricated revisions and unauthorized actors. Preserve drafts when a targeted contribution changes or is withdrawn before submission, using existing freshness/conflict behavior.

Do not rewrite earlier records. Version-4 initial responses and version-6 replies have known membership in a dispute but no explicit reply-to target beyond that root. Show them as chronological direct children of the dispute, with a brief **Earlier response — no specific reply target recorded** explanation where needed. Never draw a chain suggesting they answered one another. New replies may explicitly address these earlier responses.

Likely touchpoints: `dist/interaction-grammar.mjs`, `dist/discussion.mjs`, `dist/interaction-presentation.mjs`, account projection/validation, `worker/account-api.mjs`, and an additive migration under `supabase/migrations/`. Inspect exact metadata and snapshot checks before finalizing the new field shape. Retain versions 4–6 and their revision validation, recipient rules, service-only database execution and privacy filtering.

### 2. Build a pure dialogue projection and layout

Add a focused model module, such as `dist/argument-dialogue.mjs`, that derives the visible claim/dispute/reply tree from authorized workspace records. Keep grouping independent from DOM rendering so it can be checked against both the canvas and chronological log.

Add a layout module using measured card bounds, stable sibling order and subtree spacing. Cover empty nodes, multiple disputes, branching, long chains, earlier replies, collapsed branches, edits and withdrawal placeholders. Handle invalid/unavailable references defensively without exposing hidden content or inventing relationships.

Existing `dist/argument-canvas.mjs` and `dist/argument-ui.mjs` implement the older proposal-based Argument view. Reuse appropriate canvas primitives and gesture behavior, but implement this as a distinct current-dialogue view rather than reviving the retired Ground/Evidence/Value workflow.

### 3. Add the canvas, composer and shared log integration

Add a dedicated dialogue canvas/controller and scoped styles. Reuse the current interaction presentation, forms, save path, own edit/withdraw controls, earlier versions, optional references and validation messages.

Extend `dist/interaction-ui.mjs` so Reply from a specific card or log entry carries its explicit target. Reply at the dispute level addresses the dispute. The composer must show that distinction before submission, including when reopened from a parked draft.

Keep record IDs stable across retries, including lost acknowledgements. Preserve additional typed changes if an earlier submission succeeded remotely. A successful reply must appear once in both views. Do not autosubmit an unfinished contribution or edit source-map wording when adding dialogue.

### 4. Integrate navigation, refresh and export

Integrate the subview with the current app/mode controller and Library hash routing. Include comparison, source map/node and optional contribution identity in a shareable URL. Validate access on direct navigation and reload; unavailable links give a clear message and a route back without leaking private wording.

Maintain separate comparison and dialogue camera state. Opening the chronological log must not discard the dialogue camera. Back/forward navigation, Back to comparison, switching modes, changing source and opening references must use existing draft protection. Park and restore drafts when supported; otherwise require the existing explicit discard decision.

Background/manual refresh updates messages, history and layout without discarding a draft, stealing focus, collapsing inspected branches or fitting the canvas. Source edits preserve recorded dispute snapshots and expose existing changed-source warnings; the current source card must not silently replace historical wording. Source privacy/deletion uses existing projection boundaries and permitted history.

Register new assets and module dependencies in the production builder, asset verification and standalone exporter. Portable comparisons must display the same tree and preserve reply targets/history under their existing authoring permissions. Account import remains its current private-map-copy operation.

### 5. Verify the complete exchange

- Model and real isolated PostgreSQL: branching A → B → A exchanges, multiple siblings, same-person follow-ups, many exchanges, immutable reply targets, historical versions, edit/withdraw history, forged targets, target revision races, root withdrawal and permission parity.
- Two-account browser flow: enter a node, create a dispute, respond, reply to a specific response, branch from an earlier contribution, refresh/reload both accounts, and read the same records in log and canvas.
- Navigation and reliability: restore comparison camera/folds/selection, distinct node/comparison scopes, empty states, direct links, browser Back/Forward, parked drafts, reference navigation, failed saves, exact retries and lost acknowledgements.
- Presentation: straight connections with no card intersections, crowded sibling branches, deep chains, long text, multi-category and category-only disputes, withdrawn ancestors, keyboard operation, normal text selection, narrow screens and sensible reveal/zoom behavior.
- Boundaries: no changes to source maps, counterpart links, assessments, Inquiry/Compare authoring, connection-dispute behavior or older compatibility views. Confirm unavailable/private content is not exposed through graph edges, labels, historical target previews or URLs.
- Run the complete active release suite, currently 53 checks, adding meaningful focused dialogue checks and reporting the actual final count. Inspect representative desktop, dense-branch and narrow-screen captures.

### 6. Release and document when execution is requested

Use the existing branch `redesign/node-interactions`. Commit/push implementation, run hosted checks on the exact source, and follow the established staged database/Worker release process.

Add a distinct client capability for targeted replies. Old tabs that cannot preserve/read the new metadata must receive the existing draft-preserving refresh-required response. The additive database change must continue accepting old formats during deployment; activate new authoring only with a compatible reader and validation available. Do not modify already-applied migrations or existing production discussions.

After deployment, verify public assets, account boundaries, settings and migration results. Once new-format replies exist, any rollback must retain their reader and validation. Record the actual Worker version, source, migration and verification evidence in deployment status.

Update this plan, current workflow, interaction grammar, next-work plan and testing checklist. Keep deferred product work and Argument resolution outside this release.

## Acceptance

- A participant can enter an ordinary node from Argument and return to the same comparison view.
- Each dispute is an identifiable branch; new reply connections identify the contribution actually addressed.
- Earlier exchanges appear without invented reply relationships.
- Log and canvas contain the same attributed messages and history, and both support the relevant response actions.
- Users can continue indefinitely within existing workspace storage limits, branch a discussion and follow its connections.
- Dense dialogue uses more canvas space with straight connections; pan, zoom, expansion and text editing remain usable.
- Privacy, draft preservation, retry behavior and historical compatibility survive the new view.
- No resolution, automatic agreement or source-map mutation is introduced.
