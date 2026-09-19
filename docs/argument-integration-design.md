# Argument integration decision

Prepared September 18, 2026. This is an implementation design, not a claim that the new features are deployed. Read with [the weekly plan](next-week-plan-2026-09-21.md), [acceptance plan](argument-acceptance-plan.md), and [completed preparation record](argument-preparation-status.md). The [clickable sketch](design/argument-interaction.html) demonstrates one interaction chain.

Implementation note (September 19 UTC): the core design below is now implemented. The sections describing the earlier starting point are retained as design history. See [the current workflow](current-argument-workflow.md) and [deployment status](deployment-status.md) for delivered behavior and release evidence.

**Later UI clarification:** Compare provides inquiries and information requests; Argument provides reasoning and critique, including fallacy objections. They share the same saved Comparison. [The interaction and sorting rules](compare-argument-ui-rules.md) supersede earlier designs exposing both sets of actions in Compare.

## Decision

Extend the existing Comparison conversation records (`discussions`) into the current Argument mode. A **reason** is an authored, versioned contribution that supports one source position or an earlier contribution. Its support connection is derived from its immutable target. A challenge can target the reason's wording or that specific support connection.

Do not introduce a new graph collection or require a legacy proposal. Do not retarget, rewrite, or copy existing `argumentNodes` / `argumentEdges` automatically. Those remain the older proposal-version graph, available through **Earlier reasoning** with its original history and links. Current questions, challenges, replies, and relationship judgments continue to use their original records and IDs.

This is deliberately an anchored reasoning tree with branches and challenges to inferences. A reusable reason supporting several different conclusions and arbitrary graph cross-links are outside this first increment. That restriction makes the complete position → reason → challenge → response workflow feasible without adding another storage system.

## What the code already provides

- `discussion.mjs` owns comparison membership, author-only edits, immutable targets, version history, source snapshots, and node / map-edge / contribution targets.
- `conversation-tree.mjs` follows contribution targets to a map anchor and groups discussions into attached conversations. Its current assumption that every `kind: argument` record is a challenge must change before adding reasons.
- `argument.mjs` requires a proposal and exact proposal revision. Its node and edge references cannot be used for new proposal-free contributions without changing the meaning of saved records.
- `definitions.mjs` validates explicit library-version snapshots. At present only source-context records can invoke them, and their body must equal the rendered definitions.
- Account projection shares discussion records only with comparison participants while both source maps are available to that participant. Private definition libraries are author-only. The Worker validates writes; database triggers additionally enforce ownership, thread membership, and target identity.

## Record model

Keep `kind: discussion` at the account-storage level and the existing discussion version/history envelope. Add the discussion action `reason` under `kind: argument`.

```js
// Illustrative fields; normal timestamps, history and source snapshots also apply.
const reason = {
  id: 'discussion-reason-1',
  comparisonId: 'comparison-thread-1',
  authorId: 'alice',
  kind: 'argument',
  action: 'reason',
  target: {type: 'node', mapId: 'alice-map', nodeId: 'claim-1'},
  other: null,
  body: 'A continuous protected route would remove the most exposed crossings.',
  referenceUrl: 'https://example.org/study', // optional; HTTP(S) only
  definitionRefs: [], // optional explicit snapshots of the author's library entries
  status: 'active',
  version: 1,
  history: []
};

const furtherReasonTarget = {type: 'entry', entryId: reason.id};
const challengeToStatement = {type: 'entry', entryId: reason.id};
const challengeToInference = {type: 'inference', entryId: reason.id};
```

The last two targets differ intentionally. A statement challenge questions whether the reason is true. An inference challenge questions whether that reason supports its stated conclusion. The inference's stable display identity is derived from its reason ID; it is not another database row. A reason can therefore be saved atomically with its connection in one contribution.

For the first increment, **Explain my reasoning** adds a reason to the author's own ordinary source node, reason, or Argument-layer response. The UI does not offer general-purpose support for another person's agreement or source node. A response to a challenge remains a reply; it can explain, cite a reference, invoke definitions, and subsequently have its own supporting reason or challenge. The source worldview is never edited as a side effect.

Preserve the existing challenge choices and existing legacy argument actions as readable values. Adding `reason` must not reinterpret historical `support` or `evidence` discussions as new reasoning automatically. New records need no mandatory title, question, proposal, evidence type, or co-sign.

## Required invariants

1. **One Comparison:** every non-context contribution remains attached to one canonical `comparisonThread`; both direct and transitive targets stay in that thread.
2. **Stable meaning:** a saved reason's target and role as a reason are immutable. Editing its text creates a new version. Moving its connection requires withdrawing it and making a new reason. An edit cannot turn a referenced reason into a challenge, or a challenge into a reason.
3. **Anchored, acyclic traversal:** both `entry` and `inference` references participate in the existing iterative cycle check. An inference reference must resolve to a reason, then follow that reason's target. Reasons cannot target inferences in the first increment. No self-reference, cross-thread reference, missing reference, or cycle is valid.
4. **Current targets for new work:** a new contribution may target only an available, active endpoint. Existing discussions remain readable when a target is withdrawn or source wording changes; their historical snapshot is not overwritten. The display shows the unavailability/change instead of silently moving the argument.
5. **Exact source history:** a statement target retains its current version and wording. An inference snapshot includes the reason's ID/version, wording, invoked definitions, and the immediate conclusion target's wording/version where applicable. Do not recursively embed the whole chain in every snapshot. Capture the direct endpoints and use bounded traversal for upstream change indicators.
6. **Own contributions only:** users can edit or withdraw their own contributions. Only the challenger resolves/reopens a challenge. Accepting or maintaining a position is the recipient's attributed response. Reason entries cannot receive challenge-resolution events.
7. **No automatic consensus:** replies, reasons, acceptance, and one author's resolution do not change the relationship judgment or imply both users agree.
8. **Explicit definitions:** allow `definitionRefs` on arguments and Argument-layer replies while preserving source-context behavior. Validate every newly invoked snapshot against an exact version in the author's private library; do not require the explanatory body to equal definition text. Preserve referenced versions in history. Sharing a contribution reveals only the invoked snapshots, not the rest of the library or later versions.
9. **One visible edge per displayed pair:** use the existing pair grouping for actual card/source endpoints, including collapsed proxies. A support connection and its challenge indicator share one route; selecting the route reveals the inference target. Multiple historical meanings stay available behind the route, rather than drawing extra lines. A connector to an inference attaches to that route's marker, not a duplicate node-to-node arc.

## UI and session integration

Compare and Argument are focus modes of the same Comparison. They share source maps, camera, selection, expansion state, and one draft store keyed by actor + comparison + target + action. Mode switches change emphasis and visible detail, not storage identity or the draft's target. Switching comparisons can retain each comparison's in-memory draft; sign-out/account change must clear or explicitly resolve pending drafts rather than exposing them to another account.

Extract a current reasoning projection/interaction module from the growing `discussion-ui.mjs`. It derives reason cards and connections from discussions; it does not save a second graph. Keep the legacy `argument-ui.mjs` and `argument-canvas.mjs` behind the earlier-reasoning entry point.

Collapsed indicators distinguish reasons from open challenges. Existing inquiry visibility remains available. Expanding the focused chain should not expand every conversation. Attribution uses the existing map-owner colors and names; interaction state does not recolor the entire graph. No manual node dragging or saved layout coordinates are introduced.

## Modules affected during implementation

| Area | Intended change |
| --- | --- |
| `dist/discussion.mjs` | Add reason action, inference target validation/snapshots, reason-role immutability, explicit reason/challenge predicates, target and outcome rules. |
| `dist/conversation-tree.mjs` | Follow inference targets, derive reasoning branches/connections, count reasons separately, preserve grouped edges and anchor behavior. |
| `dist/definitions.mjs` | Separate reference validation from source-context body formatting; permit explicit references in new reasoning and responses. |
| `dist/discussion-ui.mjs` plus a focused reasoning UI module | Reuse the existing composer, cards, history, references and definition picker; introduce Explain my reasoning and distinct claim/inference challenge actions. |
| `dist/workspace-ui.mjs`, `dist/account-ui.mjs`, comparison canvas state | Keep shared mode/draft state; preserve existing autosave/conflict safeguards and account boundaries. |
| `dist/workspace.mjs`, account API and portable export/import | Add a capability/version boundary for new records; accept older files without rewriting their authored records. |
| `worker/account-policy.mjs` | Apply the same model validation to new records, preserve complete thread privacy projection, and reject foreign or stale targets. |
| A new Supabase migration | Extend the discussion trigger for inference references and immutable reason semantics; preserve all existing kinds, grants and histories. |
| Existing discussion, account, database, definitions and browser tests | Add the cases below while retaining legacy argument tests unchanged. |

## Database and permissions transition

Use the existing `harmonious_records` table, `discussion` record kind, Comparison index, and atomic `harmonious_commit` RPC. No new table, public role grant, legacy-row migration, source-map rewrite, or backfill is needed. Preserve service-only access and the server-held key; author/thread checks remain application authorization, reinforced by database checks. RLS and grants should remain unchanged; these are separate access controls in the [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

The discussion trigger currently treats every target other than `entry` as a map source. It must explicitly recognize `inference`, require an active reason in the same thread, and preserve reason-role identity on edits. Retain existing source-map checks, owner checks, and reply ownership. Add matching direct-database tests so bypassing the UI or calling the RPC cannot substitute a foreign target.

The current commit RPC sorts record kinds, then retains discussion input order. Before saving a batch, order newly created dependent discussions parent-first in the Worker; reject cycles before calling the RPC. The RPC should continue rejecting missing targets atomically, including a child-first direct call. Do not silently retry a half-saved chain. Existing per-record revisions and the generation lock continue to arbitrate simultaneous saves.

This preparation did not change or inspect live database data. The saved migration files are the schema evidence. Implementation must inspect the current migration state and follow the Supabase migration/test workflow before applying the additive trigger change.

## Compatibility and rollout

1. Add reader/validator support and the tests before exposing new write actions. Do not allow the new reason action through a UI whose counts or outcome controls still assume all arguments are challenges.
2. Version the portable workspace format for the new records (schema version 3); the new application continues accepting versions 1 and 2 through the existing upgrade path. Old exports retain old semantics. Full exports retain both discussion reasoning and the unchanged legacy graph. Account import continues making private map copies rather than claiming other people's conversation identities.
3. Add an explicit client capability on account requests (for example, `comparison-reasoning-v1`). Stage the compatible client/Worker before activating new writes. Once new records can exist, a stale client without this capability must receive a clear refresh-required response before reading or writing the affected workspace. Preserve its unsaved local work and offer export; do not force a reload that discards drafts.
4. Apply the additive database trigger change before enabling new writes, then enable the matching client/Worker together. Verify the deployed public assets and two-account workflow. Old proposal records remain reachable through Earlier reasoning.
5. Roll back by disabling new reason/inference write controls while retaining the compatible reader and additive database support. Rolling back to a pre-capability validator after new records exist is unsafe; it would reject valid saved workspaces. No rollback deletes reasoning records.

## Implementation details that must be proven by tests

- Reason → own source, further reason → own reason, challenge → statement, challenge → inference, reply → challenge, and reason → own response all save/reopen in one Comparison.
- Input order cannot create a partial chain; correct parent-first saves work in both the memory and database stores. Rejection leaves all records and revisions unchanged.
- Foreign thread/author, missing/withdrawn endpoints, invalid inference target, self-reference, long cycles, forged definitions, and cross-account draft leakage are rejected.
- Editing a reason or its conclusion changes inference health while preserving the exact original two-endpoint snapshot and history. Changing an ancestor makes the chain's review indicator accurate without recursively growing stored snapshots.
- Counts, resolution controls and filtering distinguish reasons, challenges, replies and inquiries. One visible edge per rendered pair is maintained through branch collapse/expansion.
- A participant losing access to either source cannot receive new discussion records, reference snapshots, or library content through an old link, mode switch, refresh or export. Existing legacy projection behavior is not broadened.
- Simultaneous saves cannot overwrite another author or erase a newer revision. Mode switches preserve drafts; account switches do not expose them.
- Existing proposal graphs, IDs, revisions, portable fixtures and Earlier reasoning routes still work. Pre-upgrade clients fail clearly without corrupting data or discarding unsaved work.

No product decision remains open for this initial chain. The first implementation slice is the reason action and inference target model with privacy/history/database tests, followed by the on-map interaction. Richer cross-links, collaborative support of someone else's source position, automatic migration of old argument graphs, manual dragging and pod design remain deferred.
