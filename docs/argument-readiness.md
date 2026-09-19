# Code review and Argument readiness

Release update: the reviewed foundations and first Argument view are now deployed. See [deployment status](deployment-status.md) for verification and the pending live walkthrough. This assessment below records the implementation stages.

Reviewed and updated September 10, 2026. This assessment describes the local working tree. The cleanup, durable Comparison foundation and proposal-review workflow below have not been deployed; see [deployment status](deployment-status.md) for the live release.

## Product direction

Compare overlays the two source worldviews and records judgments about their questions and answers. Argument should open directly over that same comparison, with its own view and controls. Switching views should preserve the map pair, selected proposal, and useful spatial context. Neither comparing nor arguing should silently rewrite either person's original worldview.

The owner has prioritized Compare and Argument. Pod maps are deferred: the existing co-sign-derived prototype does not settle whether future pods should be derived or authored.

## What exists

| Area | Current implementation | Implication for Argument |
| --- | --- | --- |
| Overall comparisons | `comparisonThreads` stores one parent per unordered map pair. The main list includes empty comparisons and drills into proposals. Creation retries safely under concurrency; the database enforces pair uniqueness. | A stable Comparison ID is now available for Argument. Its initial status is active; archive and other lifecycle actions are not implemented. |
| Proposed judgments | `workspace.mjs` stores append-only proposal versions and each participant's judgment, source references, clarification response and confirmation history. | A reasoning thread can now pin its proposal revision and detect when review is needed. |
| Agreement | `comparisonConsensus` derives pending, source-review, differing, or agreed states. | Agreement on an apparent divergence is not confirmation that cross-elicitation happened. |
| Canvas | `compare-canvas.mjs` and `comparison-layout.mjs` overlay maps, preserve source identities, and connect selected correspondences. | Reuse navigation and source placement; add a separately validated reasoning graph and layout. |
| Map grammar | `model.mjs` validates a three-frame forest plus a restricted set of cross-links. | It lacks Grounds, Evidence, Value, supports, evidence-for, and rebuts. Reasoning should not be forced into the map's parent/child structure. |
| Accounts | The Worker checks identity, visibility, ownership and revisions; a service-only database RPC saves changes atomically. | Shared Argument writes need equally explicit participant and field-level rules. |
| Synchronization | Whole-record optimistic revisions, autosave, and quiet polling. | Adequate for the current beta; a single giant argument record would cause avoidable editing conflicts. |

The original framework remains useful for reconciliation semantics. Its old descriptions of a facilitator-only prototype are historical, not a description of today's software.

## Cleanup completed locally

- Agreement now compares the actual question as well as status labels, and requires the same reviewed source versions. Each person's judgment pins its sources. Older shared judgments without individual source snapshots display **Source review needed** until reviewed; their exact earlier reviewed versions cannot be reconstructed reliably.
- Each person's saved history remains intact. New revisions no longer recursively embed the entire history. The server preserves the saved history prefix while allowing multiple local revisions before autosave. It rejects forged changes to another person's judgment or to the creator's displayed summary.
- The review panel now shows both participants' questions, notes and source histories. A clean open form refreshes when another device changes its saved judgment, preserving the selected proposal.
- A participant cannot receive another person's private source snapshot merely because they own the other compared map. The recorder retains their historical comparison; the other owner sees the record only while both sources are visible to them. This is deliberately conservative. A future persisted Comparison should distinguish shared historical revisions from later private edits, so previously shared history can remain available symmetrically.
- Elicitation can acquire a previously missing counterpart before anyone else has judged the proposal. Once another person has judged it, changing its source nodes requires a new proposal. Comparisons between two maps owned by one person are accepted and labeled **Your comparison**.
- Map-pair grouping uses an unambiguous, order-independent key. Account changes clear obsolete selections.
- The Windows account-test entry point now executes its suite instead of silently skipping it. The in-memory store preserves the original record owner, matching PostgreSQL. Database tests apply the original migration followed by the shared-judgment migration, whose filename now matches its live timestamp.
- Setup and status documentation now distinguish current signup settings, the deployed release, and pending local work.

These changes retain the existing record format and do not require an additional database migration. Existing deeply nested historical entries are preserved rather than rewritten. This was a targeted review of the Compare-to-Argument path and account boundaries, not a comprehensive penetration test.

## Recommended implementation sequence

### 1. Give overall Comparisons a durable identity

**Implemented locally.** The new `comparison_thread` record, `/api/comparisons` start/open endpoint, empty-comparison list, and direct links provide this foundation. Migration `20260910212254_overall_comparisons.sql` backfills parents without changing proposal IDs or histories. See [overall Comparisons](overall-comparisons.md) for behavior, access rules and rollout details. The following paragraph records the design target; private-source invitations and richer lifecycle actions remain deferred.

Introduce a Comparison record with a canonical unordered pair of map IDs, participant IDs derived on the server, creator, timestamps, revision and lifecycle. Enforce one Comparison per pair atomically in the database, including simultaneous creation with reversed A/B order. It must exist before any node judgment is proposed, appear for both authorized owners, and have a stable route.

Migrate existing node-level comparison records into proposals beneath that parent, preserving their IDs, attribution, judgments and histories. Multiple proposals about the same nodes may be legitimate revisions or alternatives; do not silently collapse them. Keep adapters for portable workspaces and previously saved links. Define private-source invitation and history access explicitly before expanding sharing beyond currently visible maps.

### 2. Make proposal review and elicitation explicit

**Implemented locally as a minimal workflow.** [Proposal revisions and clarification](proposal-review.md) documents numbered proposals, separately authored responses, mutual review and invalidation when questions, sources or responses change. Multiple independent prompts and a richer elicitation conversation remain later work.

Separate a proposed correspondence from each person's response. Give the proposal a revision and pin each judgment to that revision and the source versions. Distinguish agreement on the same question, agreement on the answer relationship, and endorsement of any combined wording.

Record elicitation questions, each person's response, and both participants' confirmation that an apparent divergence remains after clarification. An **Open Argument** action may collect reasoning while clarification is underway, but must not label a divergence confirmed prematurely. Source edits should mark affected judgments and reasoning for review without deleting prior work.

### 3. Build the smallest useful Argument slice

**Implemented locally.** See [Argument view](argument-view.md) for the workflow, storage boundary, review rules, tests and release steps. The proposal/version itself is the graph parent; nodes and connections are separate owned records. Rebuttals currently target positions and reasoning nodes. The design target below remains useful for later refinements.

Open one proposal in a separate Argument view with its two source positions in their Compare locations. Let each participant add Grounds, Evidence (with a source link and explanation), and Values, connected by supports, evidence-for, and rebuts. Make authorship and relation direction visible. Allow multiple reasons and cross-links; select, edit, remove and undo should not alter the original maps.

Use separate records for the argument thread, authored nodes and edges rather than putting all reasoning into one shared comparison JSON value. Suggested references are `comparisonId`, `proposalId`, `proposalRevision`, author, timestamps and revision, with explicit pinned source references for reasoning that depends on worldview nodes. Validate every edge endpoint, target revision and participant on the server. Decide whether a rebuttal can target a claim only or also an inference, and represent that explicitly.

First acceptance flow: one owner opens a proposal, adds a ground and evidence; the other owner sees it, adds a rebuttal and a value; both switch between Compare and Argument, reopen from another device, and retain the same sources, attribution and reasoning.

### 4. Add reconciliation outcomes and reversible agreement display

Support factual, logical, values-based or layered fork classifications and the prompt **What would change your mind?** Record proposed outcomes such as resolved, productively deferred or precisely irreducible. Each participant confirms their own position; one person's action cannot assert a joint resolution.

An agreed pair may eventually display as one shared card with both source identities and an expand control. This should be a reversible comparison presentation, not destructive merging of user nodes. Agreement about alignment alone does not mean both people endorse newly synthesized wording.

## Engineering work before the layer grows

- Extract proposal/review rendering from the large workspace controller into focused modules. The new form-loading method is a starting boundary.
- The independent Cloudflare Worker now uses esbuild for its module graph. The historical Sites script and portable exporter still use concatenation; broader tooling consolidation is deferred. `dist/` currently contains authored frontend source despite its name; any source-directory move should be a separate, tested change.
- Avoid full-database snapshots as the lasting account loading strategy. Argument adds records quickly; move toward participant-scoped reads and incremental revisions, preserving the existing access boundary.
- Add authenticated browser acceptance coverage for grouped comparisons, elicitation, source review and two-person disagreement. Current DOM-level checks verify form behavior, but do not prove canvas appearance or the live browser journey.
- Before release, test simultaneous parent creation, cross-account edit rejection, hidden/deleted source behavior, proposal revision invalidation, independent node edits, export/import compatibility and switching views without losing drafts. Review the new database permissions and migration against the service-only design.

## Verification of this cleanup

The application, graph/layout, comparison model and review panel, account isolation/API, PostgreSQL migration, autosave and signup suites pass. The Cloudflare build, generated Worker checks and whitespace checks also pass. Browser layout and a live two-account save/reopen flow were not exercised in this review. No live account data was changed.

The durable Comparison and minimal proposal-review foundations are implemented locally. The small two-person Argument flow and focused Worker bundler refactor are now implemented locally. Visual review, live acceptance and coordinated deployment remain before release. Pod redesign, automated semantic matching, automated fact-checking and automatic merging are outside that first slice.
