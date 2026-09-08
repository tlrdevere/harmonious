> Historical development notes from the earlier prototype. Current setup is described in [independent-beta.md](independent-beta.md).

# Harmonious prototype

The current development build prepares Harmonious for **independent Cloudflare hosting with Supabase accounts and PostgreSQL saving**. It includes email-code sign-in for invited testers, private/shared map settings, server-enforced ownership, authenticated co-signs, automatic saving, and per-record conflict checks. External service setup and a live preview are still pending. See [the beta setup and migration notes](independent-beta.md) for the deployment requirements, privacy model, and remaining acceptance checks.

`npm run verify` checks the legacy map features, new account/storage rules, PostgreSQL migration, and independent Worker build. `npm run build` now builds the independent app. `npm run build:sites` preserves the earlier Sites build for rollback; the existing live Sites URL has not been updated by this migration.

## Earlier facilitator prototype

Radial worldview maps, shared-canvas comparison, authored reference maps, explicit co-signing, and derived node memberships.

The current implementation includes named individual maps; topics, questions, positions and explainers; typed structural and relational edges; source references; a shared radial comparison canvas; question convergence before answer comparison; provisional divergence labels; stable map/node references; saved source snapshots; review flags after source changes or deletion; and retained earlier comparison judgments.

The comparison view places both maps on one canvas, in two rows with aligned frame columns. Each map starts with its three roots and has independent expansion and frame filters, while pan and zoom are shared. A node selected in each map gets a temporary connector. Recorded comparisons appear as clickable links; opening a record reveals and focuses its sources. A collapsed source is represented by a dashed connection at its nearest visible ancestor, without changing the original correspondence. Source deletion and edits still retain snapshots and trigger review flags. The complete map can be fitted at any time, with selected source text also available in the panel.

The downloadable `review/Harmonious-cosign-prototype.html` opens in Explore & co-sign. `review/Harmonious-shared-canvas.html` opens in Compare maps; `review/Harmonious-radial.html` opens in the individual editor. **Save workspace file** downloads a JSON workspace containing all maps, shared wording versions, co-signs, and comparisons; **Open file** restores it. Existing workspace JSON files remain compatible. It does not use browser storage as authoritative data. Inputs must first be saved to the node or recorded as a comparison.

The hosted implementation uses a private Site workspace in D1. **Save workspace** writes the complete validated workspace with an optimistic revision check; conflicting or failed writes retain the current browser content and recommend a file backup. Site access controls govern access to the whole workspace. Participant names identify whose views are represented; this is a facilitator-operated workspace. Co-signs are explicitly labeled as recorded for a selected participant; they are not independently authenticated signatures. Separate participant accounts, concurrent editing, and cross-elicitation remain future work.

The saved Site version must be published before its online storage and database migration become available. Do not infer that saving a version updated the live URL.

## Co-signing and pod views

**Maps** can be personal worldviews or authored reference maps. Both have stable participant/creator IDs; identical names do not merge maps or people. Creating a reference map from another map creates an attributed, independent copy and records no endorsement. The two sample reference maps are illustrative, with no prefilled co-signs.

**Explore & co-sign** browses all workspace maps and searches their node wording. “Most co-signed here” uses actual current workspace records, not a fabricated public trend. Choose the participant in “Recording for,” select a node, then preview exactly what to co-sign, copy, or include in a section/map endorsement. Co-signing can also add a linked occurrence to one of that participant’s personal maps. Copying produces separate wording identities with source attribution. Frame headings are excluded from endorsements.

**My co-signs** retains the precise wording versions and selected structure, supports withdrawal, and flags changed wording, changed selections/structure, adapted or removed personal copies, and removed sources. Reviewing explicitly replaces a record while preserving the earlier one. New nodes never inherit endorsements. Updating an adopted copy to accepted wording is explicit; the original is never silently pushed into personal maps.

**Pods** derives node memberships for a chosen population and threshold, using a source map’s arrangement as context. Context-only ancestors are labeled and muted. Counts deduplicate people across records. The node-set panel intersects memberships to show who co-signs every selected node; independent per-node majorities are not presented as one group. Layout edges remain the guide map’s structure, not a claim that everyone endorsed those relationships. The absence of a co-sign is treated as unestablished, not disagreement.

Workspace schema v2 separates stable shared wording from local node placement: each placement still has at most one parent in its own map. Wording versions include the frame and substantive node fields; personal confidence and placement remain local. Editing an original appends a version; editing linked wording creates an attributed independent identity. Version-1 files upgrade without changing previous comparison snapshots or manufacturing agreement. Existing D1 storage continues to save the complete validated JSON workspace; no new database migration is needed.

See `docs/endorsement-model.md` for the current design choices and limits.

Development commands:

- `npm test`: graph, radial layout, correspondence/provenance, endorsement identity and versioning, v1 file migration, and SQLite persistence checks.
- `npm run db:generate`: generate schema migrations after changing `db/schema.ts`.
- `npm run build`: compile a dependency-free Worker with the complete frontend and Sites migration metadata.
- `python scripts/export-standalone.py`: regenerate the portable HTML.

The active frontend remains in `dist/`; the existing buildless frontend was preserved while adding the Worker API. `dist/server/` and `dist/.openai/` are generated output. Applied Drizzle migrations must remain immutable.
