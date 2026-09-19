# Initial Argument view

This document describes the earlier proposal-based implementation retained for compatibility. The current on-map extension is specified in [Argument integration design](argument-integration-design.md), with [preparation and baseline results](argument-preparation-status.md). Its new workflow does not require a proposal or co-sign.

Implemented and deployed September 10, 2026; now included as a mode within Comparisons in the Library release. Two-session browser checks pass with isolated test accounts; the owner's real-account acceptance remains pending. See [deployment status](deployment-status.md).

## User workflow

1. In **Map Library → Comparisons & arguments**, open an overall Comparison and select a recorded proposal. Choose **Argument** in the mode switch below the shared header. **Open Argument for this proposal** remains a shortcut beside the judgment form.
2. Argument opens over the same map pair and carries over Compare's expanded branches, filters and camera. The two selected positions show the wording saved with the chosen proposal version. **Fit reasoning** includes those positions and the reasoning cards.
3. Add a Ground, Evidence or Value with a title, explanation and optional reference URL. It can connect immediately to either saved position or another reason. New cards appear in author columns below the source maps, and the view fits after a new reason is added.
4. Add connections from your own reasons using **Supports**, **Evidence for**, or **Rebuts**. Arrows point toward the position or reason being addressed. An Evidence-for connection must start at Evidence. Rebuttals currently target positions or reasoning nodes, not connections.
5. Select a card or an entry in the reasoning list to read or edit it. Only its author can change or withdraw it. Both participants can read the same graph while the underlying proposal is available to them. Account changes use the existing autosave and refresh flow.
6. Switch between Compare and Argument without losing an unfinished form. Switching to another proposal or leaving these views asks before discarding that form. Each view retains its own controls. A direct Argument link includes the Comparison, proposal and proposal version.

Reasoning can begin during clarification. Its presence does not confirm that both participants agree about a divergence, endorse the reasoning, or have resolved the issue. Source worldview maps are unchanged.

## History and review

Each node and connection has an author, version and append-only history. Connections pin their reasoning endpoints to explicit versions. If a connected reason changes or is withdrawn, the connection is marked **Needs review** and appears dashed. Selecting its contribution history shows its recorded endpoints and their current titles/versions. The connection's author can review it and save with the current endpoints.

Changing a proposal's question or reviewed source wording creates a new proposal version. Older reasoning remains accessible through the version selector and cannot be silently moved to the new version. It can be withdrawn; new or edited active reasoning requires the current proposal and reviewed sources. Review the sources in Compare before continuing.

Withdrawal preserves history and references. **Undo last change** creates inverse revisions rather than erasing records. Undo is local to the current page/context; it refuses to overwrite a contribution changed elsewhere. A withdrawn node's old connections remain available and need review.

## Storage and authorization

`argument_node` and `argument_edge` are independently owned account records, exposed as `workspace.argumentNodes` and `workspace.argumentEdges`. The logical graph is identified by `(proposalId, proposalRevision)`, with an immutable `comparisonId`. It reuses the existing proposal as its parent; this first slice has no additional Argument-thread lifecycle record.

The Worker checks authorship, participant membership, source visibility, graph identity, endpoint versions, history prefixes and field limits. It rejects self-links, duplicate active links and links across proposal versions. HTTP/HTTPS reference URLs are allowed. Multiple reasons, cross-links and cycles are supported without using worldview parent/child rules.

The database migration adds the record kinds and proposal index, checks parent/author identity and endpoint references, and orders atomic commits so nodes exist before their edges. The service-only access model, revoked browser grants and `SECURITY INVOKER` functions remain intact. Database checks complement Worker validation; the service credential is never sent to the browser.

Argument visibility follows the existing conservative proposal projection. The recorder can retain historical proposals with unavailable source placeholders; other participants lose access when a source ceases to be visible to them. This is not a new invitation or symmetric historical-sharing policy. Writes require both sources to remain available.

Portable JSON exports retain Argument records and histories. Opening a portable workspace restores them. Importing a backup into an authenticated account still imports private map copies only; it does not impersonate historical authors or recreate their authenticated contributions. Those remain in the original backup.

## Validation and release

The application and account suites include the actual Argument controller/canvas construction through a DOM adapter, pure layout checks, two-person contributions, author rejection, review after endpoint edits, append-only history, repeated undo, proposal-version boundaries, hidden sources, export round trips and PostgreSQL persistence. Direct database tests reject a forged author and an unversioned endpoint without changing saved data. The DOM adapter does not prove visual appearance or browser interaction.

The independent Cloudflare build now uses esbuild to bundle the Worker module graph. Frontend modules remain separate assets. The standalone exporter includes the Argument modules; the older Sites source is retained only for compatibility.

Applied `20260910212254_overall_comparisons.sql`, followed by `20260910212326_argument_records.sql`, and deployed the matching Worker as a coordinated release. Existing browser pages must reload. Private before/after snapshots were preserved, and all original record contents verified unchanged. The old live Worker cannot safely write parentless proposals after the parent migration; recovery requires a parent-compatible Worker.

Visual acceptance and an authenticated two-account browser flow remain: one participant adds a ground/evidence, the other adds a rebuttal/value, both reopen and switch views, then one edits a connected reason and the other reviews the affected link. Automated local browser inspection was previously blocked by URL policy, so it was not substituted with another browser automation path.

## Later work

The first layout is automatic and uses author columns; individual node dragging, graph search and large-graph layout are not implemented. Reconciliation outcomes, fork classifications, joint resolution confirmation, arguments against inference edges, richer elicitation conversations and reversible display of mutually aligned positions remain later work. Pod-map design stays deferred.
