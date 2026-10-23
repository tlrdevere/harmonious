# In app notifications implementation plan

Requested October 23, 2026. **Status: planned, not implemented.** Baseline: the optional Canvas / Outline presentation is live in Worker 71, with 70 local and hosted checks passing. Keep the existing browser modules, Cloudflare Worker and Supabase database; no framework change or new delivery service is needed.

## Outcome and scope

Add an **Activity** button with an unread count and a scrolling inbox. Users can see when another person interacts with their map, responds to them or changes a counterpart or standstill state. Each item opens the exact relevant node, connection, dispute or response in their chosen Canvas or Outline presentation.

The first increment is in-app only. Email delivery, summaries and browser push remain separate future work. Public/private pods and backups are also separate; this plan does not introduce pod permissions, background messages or paid services.

## Activity and recipients

Use committed records and their validated participants to decide who receives activity. Never accept a recipient chosen by the browser. Exclude the represented author from notifications about their own actions.

| Saved activity | Recipient | Destination |
| --- | --- | --- |
| Agree, Disagree or No position; inquiry; dispute | The validated `interaction.recipientId` | The interaction and its source node or connection |
| Response or further argument reply | The validated interaction recipient | The exact response, retaining its recorded reply target |
| Counterpart request, link or unlink | The other comparison participant | The request or link history and the affected nodes |
| Standstill proposal, suggestion, confirmation, withdrawal or resumption | The other participant in that argument | The standstill and its specific dispute or reply |
| New co-sign of visible source material | The source map owner | The relevant source and co-sign details; group a section/map co-sign as one activity |
| Deliberately published revision or withdrawal of an interaction | Its existing recipient | The current record and accessible history, clearly labeled as changed or withdrawn |

Do not notify for private copying, map autosave, confidence edits, draft keystrokes, background refreshes or initialization of an account. Changing a map's visibility must not generate alerts exposing its formerly private content. Define the allowed record/action transitions explicitly; unrelated metadata updates must not create activity.

Facilitated contributions keep the participant as author and the facilitator as recorder. Publish notifications only when a directed contribution or approved draft becomes canonical. A pending, declined or withdrawn private draft creates no map-interaction notification. Do not duplicate participant notifications into the facilitator's personal inbox or expand existing facilitation permissions. The initial inbox belongs to the signed-in account; opening personal activity while representing someone else requires returning to that account through the existing leave guard.

## Inbox behavior

- Provide All / Unread filters, explicit Mark read / Mark unread controls, and an action to mark the currently included activity read. Show the contributor, action, accessible context and time without truncating the only explanation of what happened.
- Group related activity by comparison and source/dispute, preserving individual events and exact targets when expanded. A group count represents its accessible events, not the number of currently rendered cards.
- Mark an item read after a successful authorized opening, or an explicit read action. Merely polling, showing a badge or rendering a row does not mark it read. Cancelling a navigation because of unfinished work leaves it unread.
- Allow per-comparison muting. Muting suppresses future unread alerts while retaining browsable history; it does not silently mark existing unread activity read. Unmuting resumes future alerts without replaying activity suppressed while muted.
- Use cursor-based pages and a stable server event order. Mark current items read sends the exact bounded event IDs returned in that list, with its server snapshot token, so later arrivals remain unread. If a broader Mark all read action is added, bind it to the accessible events committed in that snapshot. A raw sequence cutoff alone is insufficient because transactions can commit out of sequence. Repeated read requests must be harmless.
- Preserve draft text, caret and selection when opening or closing Activity. Keep ordinary mobile scrolling, keyboard navigation, visible focus, accessible unread labels, and an explicit return to the prior context.

## Durable storage and publication

Add separate activity-event, recipient/read-state and mute-preference tables. Event metadata should contain stable record/context identifiers, saved revision, event type, represented author, recorder attribution where applicable, server time and a sortable server sequence. Do not copy complete node or discussion text into notification payloads.

Use a uniqueness constraint covering record kind, record ID, saved revision, event type and recipient. Retried or replayed saves must yield one event per intended recipient. Record revisions identify a saved change; the server sequence supplies a stable pagination tie-breaker. Read snapshots must also handle concurrent transactions committing in a different order.

Create events and recipient rows inside the same database transaction as the canonical contribution. Publication cannot succeed while losing its corresponding activity, and a rejected or rolled-back contribution cannot leave activity behind. A transactional hook on canonical `harmonious_records` writes can cover both direct and facilitated publication; verify recipient resolution against the final accepted batch and existing record ordering.

This hook must cover `harmonious_commit` and the shared `harmonious_commit_before_facilitation` path. Facilitated record/approve operations use the latter directly. Private draft validation also runs that core inside a deliberately rolled-back subtransaction; its event writes must roll back with it. Capture any needed `harmonious.acting_context` attribution while present, because facilitator publication clears the setting after the core call. Do not emit activity solely from a browser callback, `saveAccountChanges()` or a second HTTP request after saving.

Inbox reads, read-state writes and muting must not increment `harmonious_generation` or enter workspace autosave batches. Otherwise opening Activity would cause unrelated content-save conflicts. Use dedicated authenticated operations and retain idempotent behavior after lost responses.

## Permissions and privacy

Authorize listing, unread counts and opening against the current `projectAccountWorkspace()` result. Checking only map visibility is insufficient: that projection also hides inaccessible references, dependent responses, assessment groups whose latest record has become inaccessible, and affected standstill families. A notification must not bypass any of those rules.

Derive displayed names, wording and previews from the authorized projection at read time. Never fall back to a stored source snapshot when permission has disappeared. Inaccessible events contribute no title, preview, search match, group label or unread count. An item that becomes unavailable between listing and opening produces a neutral unavailable result, with no old wording. Re-sharing a source must not manufacture a new event or reset its read state.

Derive inbox ownership from the authenticated session. Bound page sizes and read/update batches; reject attempts to read, mark or mute another person's activity. Use the existing same-origin checks, no-store responses and server-only Supabase access. Enable RLS and retain the project's service-only grants/revocations for new tables and RPCs. Notification endpoints must not expose the full backend snapshot.

Clear inbox caches and invalidate in-flight responses on logout, account changes and facilitation-context changes. A delayed response from a previous identity must not repopulate the current account's inbox. Workspace exports and standalone files do not gain access to authenticated activity or import notification/read state.

## Integration and refresh

- Add notification policy/projection and API handling beside `worker/account-policy.mjs` and `worker/account-api.mjs`, with narrowly scoped store methods in `worker/supabase-store.mjs`.
- Add a small Activity controller and stylesheet, registered in the existing client asset, Worker and standalone packaging paths. The authenticated inbox is unavailable in portable/offline files; their existing workflows remain usable.
- Integrate account lifecycle and request handling through `dist/account-ui.mjs`. Its workspace refresh currently runs every 30 seconds and protects dirty forms; inbox refresh must be independent of accepting a new workspace so activity can update while someone is writing.
- Poll while the page is visible, refresh after returning to it and after relevant successful actions, and back off after failures. Do not stack overlapping requests or replace drafts. Keep the previous inbox usable when a refresh fails, with a clear retry state.
- Reuse existing route and permission-aware opening commands. Resolve the source, comparison and exact entry before navigating. Preserve the chosen layout; node arguments may open their focused dialogue, while connection arguments retain their connection target.

## Delivery order

1. Finalize the event/recipient matrix above against current record types, including edits, withdrawals, co-sign grouping and legacy records that remain readable. Add pure classification tests first.
2. Add and test the transactional schema/hook, stable event identity, recipient state and mute preferences in the disposable database fixture. Verify current Supabase migration tooling/documentation before creating the migration.
3. Add authenticated list/count/open/read/mute endpoints with current-access filtering, bounded cursors and watermark semantics. Keep older clients compatible and leave notification rows outside their workspace envelopes.
4. Build Activity UI, lifecycle-safe polling and exact-target navigation for both presentations. Complete keyboard and narrow-screen review with unfinished forms open.
5. Run the focused API/database/browser checks and the complete existing suite locally and on GitHub. Review the migration and deployment against the established release procedure before publication.
6. Apply the additive migration and deploy the matching Worker/client after verification. Enable event creation from the rollout point only; do not turn existing historical interactions into a flood of new unread activity. Verify the live assets, access boundaries and a controlled two-account interaction/read cycle.

## Acceptance and verification

| Area | Required evidence |
| --- | --- |
| Recipients | Two-account cases cover every supported event, correct reply recipient, represented author, no self-alert and no alert from private copies or routine edits. |
| Transaction integrity | Invalid batches, stale revisions, rolled-back facilitator drafts and failed publication leave no event; successful direct/approved/directed saves create exactly one event per recipient. Lost responses and retries do not duplicate it. |
| Permission changes | Private, unshared, deleted and unavailable sources; hidden references and descendant replies; standstill families; inaccessible counts/groups; stale inbox links; and re-sharing preserve existing privacy rules. |
| Read state and noise | Concurrent arrival, duplicate requests, pagination, equal timestamps, grouping, mute/unmute and Mark all read watermarks retain the correct unread set. Reading activity causes no workspace-generation conflict. |
| Identity and facilitation | Another account cannot query or modify an inbox; pending drafts remain private; grant changes do not expand access; logout/context changes discard stale responses. |
| Navigation and drafts | Exact node, connection, dispute, response and standstill targets open in Canvas and Outline. Cancelling navigation preserves drafts and unread state. Background polling does not interrupt writing. |
| Mobile and failures | 320–390 px layouts, large text, keyboard/focus, long activity lists, offline/retry, expired sessions and rapid account changes behave clearly without duplicate requests or sideways panning. |
| Release compatibility | PGlite tests apply the full migration sequence, memory-store/API tests match database behavior, old clients remain usable, portable files remain independent, and local/hosted/live checks pass. |

If rollout needs to pause, disable new activity production/UI while preserving canonical contributions and saved inbox state. Do not remove tables or rewind users' maps to disable notifications.
