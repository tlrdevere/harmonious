# Durable overall Comparisons

Release update: the parent migration and matching Argument Worker were deployed September 10, 2026. The migration filename now matches its live timestamp. See [deployment status](deployment-status.md) for current verification; earlier implementation notes below are historical.

Implemented locally September 10, 2026; not deployed. This follows the owner's preference for an overall map-to-map list, with proposed judgments inside each comparison, and prepares a stable parent for Argument.

## User workflow

1. In Compare, choose two maps, including at least one you own.
2. Select **Start / open comparison**. A saved Comparison is created immediately, or the existing one opens. It does not require selecting nodes or entering a judgment.
3. Both owners can find it in **Overall comparisons** while both sources are visible to them. An empty comparison displays **Ready to begin**.
4. Open it to see **Proposed judgments**. Use **New judgment** and select source nodes to record a counterpart judgment or elicitation question. Submitting a first judgment also starts the overall Comparison if needed.
5. Opening a comparison or a proposal updates the address. That link reopens the same view after signing in with an authorized account. **All comparisons** returns to the main list.

Starting the same pair in reversed order, including at the same time from both accounts, opens one shared Comparison. A comparison between two of your own maps remains supported.

## Data and compatibility

- A `comparison_thread` account record is exposed as an item in `workspace.comparisonThreads`. It contains a stable ID, canonically ordered source map IDs, the map owners as participants, creator, creation time and `status: active`. Its storage envelope supplies the revision. This initial identity is immutable; there is no archive action yet.
- Existing `comparison` records remain the node-level proposals. Each has a `comparisonId` pointing to the overall Comparison. Its own ID, source orientation, separate judgments and history remain intact. The pending local build also includes [proposal revisions and clarification responses](proposal-review.md).
- Old portable workspaces are upgraded on validation. Their first proposal by ID provides the parent ID within the distinct record namespace, matching the database backfill. Empty comparisons survive new exports. Account imports continue to import private map copies only; original comparison histories stay in the original backup.
- Direct links use `#comparison=<parent ID>` and optionally `&proposal=<proposal ID>`. Proposal IDs supplied as an older comparison link are resolved where unambiguous. Links convey identity, not access permission.

## Access and concurrency

The authenticated `POST /api/comparisons` endpoint derives participants from stored maps, requires a source owned by the actor and access to both maps, then starts or returns the existing parent. It retries after a competing database generation change. New parents are saved without replacing local draft content; map edits must finish saving first.

The database has a unique index on the unordered source pair and a trigger validating parent/source identity and proposal references. The commit function retains its short generation lock and saves parent records before proposals. Both RPCs and the new trigger function use `SECURITY INVOKER`. Existing RLS, revoked browser grants and service-only access remain in place. This follows the [Supabase function security guidance](https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker); the Worker remains responsible for participant and per-judgment authorization.

The conservative privacy rules from the review remain: the recorder retains historical proposals when a source becomes unavailable, with a source-map placeholder. Other participants see a proposal only while both maps are visible to them. A parent also remains available when needed to contain a visible historical proposal; its metadata does not expose hidden source text. A private map does not become shared merely because a Comparison is started. Invitation-based sharing and symmetric access to explicitly shared historical revisions need a separate design.

## Validation and rollout

Automated checks cover empty comparisons, reversed and simultaneous creation from both accounts, unauthorized and cross-origin requests, private-source transitions, duplicate database parents, invalid proposal references, portable upgrades, direct-link routing, empty-list UI behavior and migration of preexisting reversed proposals with their histories. The full application/account suites, Cloudflare build, generated Worker checks and standalone export pass.

Automated visual inspection of the local preview was blocked by browser URL policy. A live authenticated two-account start/save/reopen check remains part of release acceptance.

Apply `20260910212254_overall_comparisons.sql` after the two existing migrations, then deploy the matching Worker build and reload open clients. The migration advances record revisions; an old open page may need a backup and refresh before saving. The new client/Worker requires the new database structure. The new database also requires parent references on proposal writes, so deploy the migration and Worker as a coordinated release. No migration or Worker deployment was performed during this implementation.

Do not roll back the migration by deleting parents or stripping history. Preserve a backup before production rollout. If a Worker rollback is needed, use a build compatible with parent-linked proposals; the previous live build is not a safe write-compatible rollback after this migration.
