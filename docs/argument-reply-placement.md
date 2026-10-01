# Argument reply placement

Live in **Worker 63**, October 1, 2026, after **62/62 local and 62/62 hosted checks**, the additive database migration and live verification. [Deployment status](deployment-status.md) records the exact source and evidence.

On the inner Argument canvas, an active response offers **Reply**, **Reply above**, and **Reply below** in a separate action group. Reply retains horizontal placement. Above and below are visual choices, with no inferred agreement, objection category or different response type. They use the same composer, explicit addressed contribution, chronological log and permissions. Disputes retain their existing Respond/Reply workflow, including the first recipient's outcome choices.

Placement is saved with the targeted reply and shared by both participants. It survives edits, withdrawal history, refresh, backups and facilitator draft approval. The optional `interaction.placement` field on grammar version 7 accepts `right`, `above`, or `below`; absence retains the existing horizontal default. It is immutable with the addressed contribution. No existing records are rewritten. JavaScript and the additive PostgreSQL trigger migration enforce the same contract. `argument-placement-v1` gates workspaces containing this metadata so an older tab cannot strip it.

The renderer measures each card. Mixed-direction branches fan into clear space and enlarge the occupied canvas when necessary. Straight connections are clipped to card boundaries; candidate placement checks both card overlap and connections passing through unrelated cards. Crowded branches may spread diagonally while remaining above or below their parent. Horizontal-only drawings retain their previous tree layout. Collapse, expanded text and newly saved responses reflow the visible drawing; selection stays anchored, and the outer comparison camera remains separate.

Verification extends the existing dialogue suites with long alternating chains, crowded siblings, mixed branches, varied card sizes, collapse, straight-line clearance, deterministic output, saved placement, immutable edits, malformed values, old-client recovery, direct PostgreSQL rejection and portable validation. Two-account browser coverage checks above/below authoring, reload, editing and geometry. Facilitator tests cover private placement drafts and exact approval. Full release verification and live checks are required before publication.

No new argument semantics, categories, resolution rules, manual dragging or technology-stack changes are included. Existing deferrals remain unchanged.
