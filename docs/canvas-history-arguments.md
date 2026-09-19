# Canvas, source history and on-map arguments

September 11, 2026. Implements the next three product steps approved after the code review.

The focused-action follow-up was deployed September 12 at 03:22 UTC as Worker `b569ce8e-7cf8-4edb-a4f1-7b72b6906653`. All public assets match the verified local build; release evidence is in [deployment status](deployment-status.md).

## Working on the canvas

The primary toolbar keeps Map, Inquiries and Arguments visible alongside Conversations, Refresh, View options and Full canvas. On wide screens, the main navigation shares the brand row and this comparison toolbar shares the row containing the map pair. View options contains the source selectors, frame filters, branch expansion, highlighting, Earlier records and the compatible earlier Argument view. It opens automatically when choosing a new pair, with the Start action inside the same menu. Earlier records still supports closure with Escape and returns keyboard focus to View options.

The two maps have stable blue and amber identity keys chosen from their map IDs, so reversing their first/second positions does not exchange their colors. The same key appears in the header and as a left edge on each node. Node footers name the author directly. Frame identity remains on the node's top edge using the existing green, blue and purple frame colors. The selection outline remains a third, separate visual state.

The repeated map labels and separate mode row are removed from the new flow. Existing proposals still expose their earlier Argument mode and question context. Full canvas gives the map the window, keeps a slim Exit/save-status strip visible and preserves the current conversation draft. Exit full canvas restores navigation.

Inquiries and arguments begin as compact markers. Opening one expands that marker and its conversation; closing collapses it. Markers retain their author and response count. The focused window remains on the canvas and independent visibility controls remain. The quieter source-edge hover remains, and clicking a source edge no longer starts a pan gesture.

## Source wording and review

New contributions capture the selected source wording, relevant definitions/standards, and both endpoint wordings when addressing an edge. Relationships capture both nodes. A contribution addressing another contribution captures that entry's version, body, action, reference URL and withdrawal state.

Original snapshots remain immutable. Source edits or changes to definitions create a review warning on the marker/relationship and inside the conversation. Source wording & history shows the original snapshot and, when relevant, the current wording. The contribution author can choose **Confirm current source wording** inside that history; this records a separate reviewed snapshot without replacing the original. Reviewing is not the other participant's agreement.

Earlier records without snapshots are labeled “Earlier source wording not captured.” Current wording is never presented as a reconstructed historical snapshot. Missing/deleted sources and withdrawn target entries are marked unavailable. Their existing contributions and captured wording remain accessible through Conversations while the map pair remains visible. Withdrawn contributions have their own disclosure in that list.

Privacy remains governed by the existing account projection: a comparison's conversation records and snapshots are hidden when both source maps are no longer available to that participant. No later private source edits are exposed through snapshots.

Current scope: review compares the immediate addressed source. A complete transitive dependency-review system, resolving counterpart requests, and withdrawing/editing a contribution after its source has been deleted still need separate design and database-trigger work. The current database correctly prevents writes against unavailable targets; reading their history remains available.

## Structured reasoning

From another person's source, choose **Challenge**, then General challenge, Reasoning does not follow, Counterexample or Logical fallacy or reasoning error. Relationships offer a specific **Contest agreement/disagreement** action to the other participant. Generic Support and Add evidence controls are no longer exposed in the prototype. Existing support and evidence records, histories and safe HTTP(S) references remain readable and editable by their authors.

Reasoning attaches to its selected source or parent contribution. When the parent is visible, the arrow points to that marker. When its layer is hidden, the attachment falls back to the underlying source. An argument does not change or co-sign either original worldview. Independently authored nodes remain separate.

The earlier versioned Argument model and records have not been migrated, deleted or reinterpreted. This release develops the new on-map path alongside that compatible history.

## Storage and verification

Snapshots and reference URLs are additive fields in existing discussion records, so no schema migration is needed. Worker validation checks captured wording against current authorized sources, preserves original snapshots, and enforces existing authorship/history rules. The isolated PostgreSQL suite exercises persistence and rejection of forged history.

Regression coverage includes compact markers, direct evidence links, nested reasoning, source edits/review, deleted-source history, earlier records without snapshots, private-map boundaries, drawer focus, mouse edge selection, mobile composer containment and full-canvas draft preservation. Application/account suites, earlier navigation/Argument walkthrough and portable exports are also checked.

Reload open browser tabs after release. Do not roll back to a Worker predating source snapshots and then edit these records: its older editor can drop fields it does not know about. Use a forward fix or a rollback build that preserves the new fields. Existing database rows do not need to be rolled back.

## Follow-up

The next layout pass will group questions, requests and challenges as collapsible appendages anchored to the source node or edge, leaving a visible type/count indicator when collapsed. A central author-owned definitions and standards library will replace per-node creation and allow reusable, revision-pinned invocations. Details are in [the next-work plan](next-work-plan.md). Dragging and pod design remain deferred. Development-tool advisories and the reminder about disclosure are recorded in [dependency review](dependency-review.md).
