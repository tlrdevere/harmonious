# Interaction grammar v4

The [topic alignment and focus increment](topic-alignment-and-focus.md) adds presentation behavior to existing cross-frame connections: first-tier topic alignment and explicit branch fading. It adds no connection type, assessment, ownership rule or Argument action. Counterpart placement takes priority where constraints conflict; the inner dialogue canvas is unchanged. See [deployment status](deployment-status.md) for publication.

The [experimental reply placement increment](argument-reply-placement.md) adds optional immutable `interaction.placement` to targeted grammar-v7 replies: `right`, `above`, or `below`. It has no argumentative meaning. Missing placement preserves the earlier horizontal default. The `argument-placement-v1` capability protects this metadata across saved workspaces and history; [deployment status](deployment-status.md) records publication.

The original v4 grammar was implemented on `redesign/node-interactions` and deployed at the owner's request on September 23, 2026 at 00:25 UTC (September 22 in New York). Its database migration is applied. That initial release passed **44 active release checks**; report: `build/verification/2026-09-22T22-53-25-909Z-38200/summary.json`. [Deployment status](deployment-status.md) identifies subsequent published releases. The optional portable review file remains `review/Harmonious-interactions-preview.html`.

## September 29 Argument standstills: current implementation

The [standstill increment](argument-standstill-plan.md) is **live in Worker 61**, after 60/60 local and 60/60 hosted checks, the additive migration and live verification. [Deployment status](deployment-status.md) is the authority for the live Worker, migration and completed release checks. It is the narrow approved exception to the broader Argument-resolution deferral. It records participants' shared description of an obstacle; it does not decide who is right, assert agreement with the underlying node, close other branches or introduce Pods.

| Action | Author and attachment | Required input and effect |
| --- | --- | --- |
| **Propose standstill** / `propose_standstill` | Either of the actual two dispute participants; mandatory source node plus an existing active dispute or reply in the same comparison | A trimmed, nonempty explanation, up to 10,000 characters. Records Standstill proposed. Source-node and claim-card entry points require an explicit contribution choice. |
| **Suggest changes** / `suggest_standstill` | The other participant, targeting the exact proposal revision and latest causal state | A trimmed, nonempty suggestion, up to 10,000 characters. Preserves the proposer's wording and supersedes earlier confirmation until explicit reconfirmation. |
| **Confirm standstill** / `confirm_standstill` | The other participant, after reading the full current explanation and reviewed context | An explicit receipt for that wording and context. The proposer cannot supply the second person's confirmation. |
| **Revise explanation** / **Review and renew proposal** | Only the proposer, keeping the fixed source/dispute/anchor identity | A new proposal version and reviewed context. Earlier wording and confirmations remain historical; the new version returns to proposed. |
| **Resume discussion** / `resume_standstill` | Either participant, targeting the latest accessible proposal state, including Needs review | An explicit immutable receipt ending the proposal instance. No reply or permission from the other person is required. Cancel saves nothing. |
| **Withdraw proposal** | Only the proposer, through the proposal's ordinary authored withdrawal revision | Ends the proposal instance while preserving its permitted history. The other participant uses Resume discussion. |

The form asks **Why do you believe this argument cannot move forward at this time?** Confirmation states **You are confirming this description of the impasse, not agreeing with the underlying position.** There is no extra dispute category or reason selector. Replies stay available and do not silently confirm or end a standstill. At most one unfinished instance by the same author can occupy the same addressed point; separate authors can retain different proposals. Resumed and withdrawn instances are terminal, and a later impasse requires a new ID.

The record family is `kind: 'standstill'`, with `layer: 'arguments'` and metadata `standstill.version: 1`, separate from the existing interaction grammar versions. Proposals retain the comparison ID, mandatory source target, original dispute ID, fixed addressed entry/original version, currently reviewed anchor/dispute revisions and source snapshots. Proposal edits use immutable version history. Suggestions, confirmations and resumptions are separate author-owned immutable rows targeting the exact proposal version. Their `previous` reference forms one causal sequence; `reviewedContext` binds the source snapshot and anchor/dispute revisions seen before submission. Client timestamps do not determine the current shared state.

`dist/standstill.mjs` provides the common state and count projection: proposed, confirmed, needs-review, resumed, withdrawn and unavailable. Source or anchor changes invalidate current confirmation; an unrelated new message does not. Withdrawing the original dispute makes standstills beneath its replies unavailable. Missing or inaccessible dependencies suppress a current shared-state claim instead of falling back to an old confirmation. The model, Worker and database reject outsiders, self-confirmation, fabricated anchors, stale causal transitions and cross-dispute attachments. Exact retries reuse stable IDs through the atomic account-save path.

`dist/standstill-ui.mjs` integrates the composer and detail controls with source windows, the node log, `dist/argument-dialogue-ui.mjs`, shared presentation and search. Standstills are annotations, not extra dialogue or retired-reasoning cards. Proposed, confirmed and needs-review counts remain separate from dispute/reply counts and from each other. Collapsed summaries reveal the actual contribution; explanations, suggestions, authors and status are searchable. The same comparison/source/entry route can reopen a proposal detail. Current authorized history remains attributed, including confirmations of earlier wording.

The account client declares `argument-standstill-v1`. Capability checks cover current records, historical versions and incoming writes; unsupported older tabs receive the established draft-preserving refresh-required response. The workspace envelope remains schema version **6**. The current portable reader and standalone exporter preserve this distinct record family; older readers reject the unsupported discussion kind before saving instead of dropping it. Authenticated backup import retains its existing private-map-copy boundary. A post-release rollback must retain the new reader, capability checks and validation once standstill records exist.

The current technical catalog adds `tests/standstill.test.mjs`, `tests/standstill-database.test.mjs` and `tests/standstill-browser.test.mjs` alongside the existing reply/dialogue and interaction checks. These cover model/API rules, isolated database parity and the two-account interface. The actual full-suite result and live release evidence belong in deployment status; the historical suite counts below describe their original releases.

## September 29 node-focused Argument dialogue

The [node dialogue canvas](argument-dialogue-canvas-plan.md) **shipped in Worker 58**, after all **55 local and 55 hosted checks**, the additive database migration and public verification. New targeted continuations use metadata version **7** and the `argument-dialogue-v1` capability. Their canonical target remains the original dispute; `replyTo` identifies the immutable addressed contribution and revision. The addressed entry must belong to the same dispute/comparison and be active/current at creation. Recipient identity remains the other dispute participant, including same-author follow-ups. Versions 4–6 retain their meaning, and existing records are not rewritten. Old clients encountering version 7 receive the draft-preserving refresh prompt. The canvas is a projection of the same log, with no resolution or extra relationship categories.

## September 29 continuing Argument replies

The continuing-replies follow-up **shipped in Worker 57**, after all 53 local and hosted checks, the additive database migration and public verification. Both participants may add a required message and optional node reference directly to the original active Argument dispute, with no fixed exchange count or forced turn-taking. New replies use grammar metadata version **6**, action `respond`, option `reply`, and the `argument-replies-v1` capability. The first recipient response retains its existing outcome choices. Version-4/5 records and own edit/withdraw histories remain intact. Replies stay chronological in the dispute log and do not resolve the dispute or change maps or assessments. Obsolete tabs receive the draft-preserving refresh prompt; any rollback must retain version-6 reading and validation once replies exist. See [deployment status](deployment-status.md).

## September 29 four-category Argument follow-up

The [four-category update](argument-four-categories-plan.md) **shipped in Worker 54**, after all 53 local and 53 hosted checks, the additive database migration and public verification. New disputes use grammar metadata version **5**, with exactly **Factual basis**, **Reasoning**, **Consequences** and **Feasibility**. The four choices are multi-select, at least one is required, and optional comment/reference controls remain. This supersedes the frame-specific Base/Add-on/Other dispute menus below for new authoring. Version 4 remains the historical catalog; the other modes and existing response outcomes retain their grammar and behavior.

New disputes do not infer Signals. Earlier records/revisions retain their exact labels, tags and text. Editing an earlier dispute requires explicit new category selection; previous grounds and wording remain available in Earlier versions. Version-aware client, Worker and database validation preserve compatibility, and obsolete tabs receive the existing draft-preserving refresh prompt. No argument-resolution or automatic assessment/map changes are introduced. See deployment status for publication.

## September 29 counterpart controls and assessments

The [joined-card and overview follow-up](agreement-overview-plan.md) **shipped in Worker 53**, after all 53 local and 53 hosted checks and public verification. It adds derived display states without introducing a new stance or shared source record. Mutual agreement visually joins two originals; different explicit positions, no position, absent assessments and review-required sources remain distinct. A zoomed-out presentation preserves source coordinates and source-edge identity across shared modes. Deployment status records publication.

The [counterpart controls follow-up](counterpart-controls-and-assessments.md) **shipped in Worker 52**, after all 53 local and 53 hosted checks, the additive database migration and public verification. It restricts new links to free nodes in the same frame, supports attributed unlinking by either participant, and limits creation to explicit counterpart requests. Ordinary menus omit redundant view/link-another/read-source controls. **Agree** is the visible name of the existing `endorse` action. Personal assessments appear on cards; **Both agree / Both disagree** is derived only from matching, current reciprocal assessments on a one-to-one pair. No position and Not assessed remain distinct and produce no mutual verdict. Blank-canvas clicks dismiss transient windows through existing draft safeguards. Publication is recorded in [deployment status](deployment-status.md).

## September 29 canvas dragging fix

The [canvas-panning fix](canvas-panning-fix.md) **shipped in Worker 51**, after all 49 local and 49 hosted checks and public verification. Empty-canvas drags cancel competing browser text-selection/native-drag behavior and clean up after cancellation, capture loss or focus loss. Normal node/control actions, text selection in editors/details, keyboard navigation and touch zoom remain available. It does not change the meaning or permissions of any interaction.

## September 28 full-size counterparts and straight connections

The [space and line follow-up](comparison-space-and-lines.md) **shipped in Worker 50**, after all 48 local and 48 hosted checks and public verification. It supersedes the compact ghosts introduced in Worker 49: ghosts match real card dimensions, and the occupied canvas expands to clear straight parent connections. Expansion, collapse and frame filtering preserve zoom. Adjacent counterparts use a short straight line whose meanings and authors remain inspectable; a wide label no longer causes a bent bracket. Exceptional obstructed extra connections retain safe detours. Pair eligibility, request outcomes, authorship and mode permissions remain unchanged.

## September 28 comparison positioning follow-up

The [comparison positioning follow-up](comparison-positioning-plan.md) **shipped in Worker 49**, after all 48 local and 48 hosted checks and public verification. Ordinary nodes begin independently; only qualifying saved pairs produce adjacency. Its compact ghosts are superseded by the full-size follow-up above. Ghosts are display affordances, not nodes, requests, or stances. Source geometry is shared across Inquiry, Compare, and Argument; linking/responding controls remain in Compare. Explicit links, earlier attributed pair records, unavailable-source privacy, request states, and withdrawal ownership retain their existing semantics. [Deployment status](deployment-status.md) identifies the exact published source.

## September 28 comparison clarity follow-up

The preceding [comparison clarity increment](comparison-clarity-plan.md) **shipped in Worker 48**, after all 48 local and 48 hosted checks and public verification. It replaces **Find or view counterpart** with direct **Link counterpart**, **View linked counterparts**, **Link another counterpart**, and contextual request/create actions. Linking existing nodes is available from either map when the participant owns one endpoint; creation is restricted to their own map. Ordinary selection creates no additional counterpart placeholder and does not fit the camera. Worker 48 reserved empty spots only for saved unanswered requests; the positioning follow-up supersedes that policy with compact status controls for every solo ordinary node. Source styling and route tracing are shared across views, while mode actions stay distinct. This adds no Aligned / In tension pair-assessment type; existing counterpart and stance meanings remain unchanged. [Deployment status](deployment-status.md) records the published release.

## September 28 node-face editing and copying follow-up

The accepted [node-face editing follow-up](node-face-editing.md) **shipped in Worker 47**, after all 47 local and 47 hosted checks and public verification. [Deployment status](deployment-status.md) records the exact source and publication. Worker 46's preceding menu cleanup is recorded below. The new authoring behavior retains the existing interaction and connection semantics:

- **Edit** expands the selected node face. Title, short description, and confidence are directly available; **Details** expands longer context and sources on the same face. **Save changes** keeps the face open; **Done** saves valid changes and returns to the map. Existing-node autosave preserves the field and caret. Frame names stay fixed.
- **Add child node** immediately puts an unfinished child in the map layout and focuses its title. The preview is separate from saved map data. Only final submission adds the node and any chosen reason connection; Cancel removes the preview. Draft-discard, Save now, download, and autosave safeguards continue to apply.
- All eligible confidence editors pair a whole-percentage slider with a compact number field that preserves decimals. Opening an unassessed rating does not assign a value. **Not assessed** restores null, distinct from 0%; source views and other authors' ratings remain read-only.
- Owned Library cards offer **Copy map**, opening the existing creation form with a source and suggested name. **Create map → Start with → Copy…** remains available for accessible maps. A whole copy is independent and private by default, preserving frame details, hierarchy, internal connections, citations, and attribution. It retains the owner's own confidence but clears another author's scores. It does not duplicate conversations, comparisons, co-signs, or invoked definitions.
- The existing source copy-and-adapt workflow still adds selected nodes and their internal connections to another owned destination map. It is separate from creating a whole-map copy and records no endorsement.

## September 28 menu and creation release

The accepted [node-menu cleanup plan](node-menu-cleanup-plan.md) shipped in **Worker 46**, after all 46 local and 46 hosted release checks and public verification. [Deployment status](deployment-status.md) records the exact application commit and version. These placement and wording changes retain the v4 interaction and connection semantics:

- New comparisons show two real source selectors and **Start / open comparison** directly; **Change maps** reopens setup after a pair is open. View options contains display controls. Existing-pair reopening and map sharing rules are unchanged.
- Map/Create separates **Edit**, **Add child node**, **Inspect details**, and the **More actions / Fewer actions** disclosure containing **Delete branch**. The frame containers use **Edit frame details** and omit ordinary-node-only actions.
- Child creation is a draft until the final **Add child node** action, including when entered through the plus control. It defaults to **Organization only**; **This child is a reason for its parent** creates the ordinary child and its reason connection together. Cancel creates no records. Autosave cannot submit the draft; Save now/download require finishing or cancelling it, and leaving uses the discard safeguard.
- **Inspect details** contains separate **Philosophy** and **Connections** sections. **Connect existing node** preserves the existing typed endpoint/direction rules. Philosophy is also directly available in its own Foundations group on the node menu. The old Create reason, Connect, My confidence, and Compare shortcuts remain removed.
- Eligible ordinary nodes have a persistent **Confidence —** or **Confidence n%** slot. Owners can edit during creation, in Edit, or directly from that slot; others' values are read-only. Null is distinct from zero. Source-map browsing is read-only, and frame containers and legacy non-position nodes are excluded. Shared source menus retain **Edit in my map**, without a duplicate confidence action.
- One palette identifies frames in all covered views: Status Quo `#EDAAA7`, Transformative Action `#A4C7EB`, and Goal State `#A9CFA8`. Frame labels and separate owner identity remain visible; lighter category shades are reserved.

## Consistency follow-up

The September 25 consistency pass integrates this grammar with shared previews/counts, Find in all three modes, response outcomes, and attachment navigation. It retires creation and source-confirmation paths in older workflows while keeping their history readable. New interaction and privacy tests and an active mode-consistency browser suite cover the regressions missed by earlier checks. See [the implementation plan](mode-consistency-plan.md), [current workflow](current-argument-workflow.md), and [deployment status](deployment-status.md) for the published state.

## Specification and final decisions

The specification is the revised `Interaction_Grammar_v4 (1).csv`, `Interaction_Grammar_v4_DisputeMenus (1).csv`, and `Interaction_Grammar_v4_Key (1).csv`, together with the owner's subsequent decisions in the task. Those decisions supersede conflicting spreadsheet entries:

Copies of the revised uploads are preserved in [the design references](design/interaction-grammar-v4/Interaction_Grammar_v4.csv), [dispute menu reference](design/interaction-grammar-v4/Interaction_Grammar_v4_DisputeMenus.csv), and [terminology key](design/interaction-grammar-v4/Interaction_Grammar_v4_Key.csv). The implementation follows the decisions below wherever those reference files differ.

- Compare records a position toward another person's node or connection. Inquiry includes asking, eliciting, proposing, and offering. Argument is the place for critique.
- The interface calls these items **nodes**. An ordinary node can contain a claim, reason, example, evidence, or proposed course of action. The frame containers are **Status Quo**, **Transformative Action**, and **Goal State**. Topic, Question, and Explainer are no longer creation choices. Legacy files remain readable; no bulk deletion or rewriting of saved maps is performed.
- Dispute reasoning shows a node frame's Base options plus every applicable Add-on, or the selected edge type's options. A citation title or URL supplies the source Add-on. Likely Future is excluded from this prototype.
- Eligible dispute choices are grouped into “About the claim,” “About the source,” or “About the connection.” Fallacy names appear in explanatory helper text, not as a second list of standalone actions.
- An addresses connection uses “It won't address the problem”; enables uses “It won't achieve the goal.” There is no combined fallback menu for unknown or organizational edge types.
- A response has one mutually exclusive outcome. Other interaction choices can be multi-select.
- Comments and **Point to a node** are optional, including dispute rows that previously marked a reference Required. A dispute needs at least one selected ground; other initiating actions can be saved without explanatory text. A response needs one outcome.
- “Other” opens a free-form field wherever offered, including Agree. Writing in that field is optional. Other does not infer a disagreement classification.
- Each selected dispute option's Signals tag is saved internally with that option. Tags and the Notes column are not UI text. “What it becomes” remains provisional; the reviewed application behavior below defines the implementation.

## Modes and responses

| Place | Actions | Scope |
| --- | --- | --- |
| Map / Create | Edit; Add child node, optionally as a reason; Inspect details; Connect existing node; direct Confidence | Author's own map |
| Compare | Agree, Disagree, No position | Another participant's ordinary node or connection |
| Inquiry | Request reason, Request explanation, Propose alternative, Offer reason | Another participant's ordinary node or connection |
| Argument | Dispute reasoning; contextual Reply; Propose standstill and its review/response controls | Disputes address another participant's ordinary node or eligible typed connection. Standstills are limited to ordinary-node disputes and their addressed replies. |
| Within the originating mode | Respond | Intended recipient of an active request, proposal, offer, or dispute |

Map editing retains its Maps destination. Compare, Inquiry, and Argument share a comparison canvas, source maps, and camera. Changing modes parks an unfinished form; returning restores it. Changing targets or leaving the form uses the discard safeguard.

**No position** withholds a stance rather than asserting disagreement. Its choices are “I don't know,” “I need more information,” “I haven't considered this,” and Other. Counterpart links identify comparable nodes independently of anyone's stance. Agree, Disagree, and No position do not automatically create, remove, or merge counterparts.

| Received interaction | Mutually exclusive response outcomes |
| --- | --- |
| Request reason / Request explanation | Answer, I don't know, Other |
| Propose alternative / Offer reason | Accept, Reject, Other |
| Dispute reasoning | Accept, Partly accept, Reject, You've misrepresented my claim, Other |

Only the intended recipient can Respond. Response is contextual, not another mode. Compare stances do not acquire a generic response action.

## Nodes, connections, and references

New semantic connections have an explicit type at creation:

| Stored type | Meaning and direction |
| --- | --- |
| `reason` | Reason → conclusion, including evidence; may cross frames |
| `cause` | Cause → effect; may cross frames |
| `addresses` | Status Quo problem → Transformative Action |
| `enables` | Transformative Action → Goal State |
| `nesting` | Organizational parent/child structure; no Dispute menu |

The child form's **This child is a reason for its parent** choice adds a node beneath the selected node and an explicit `reason` connection from child to conclusion in one submission. It replaces the separate Create reason shortcut; a reason is an ordinary node with that relationship, not a distinct node type. Merely nesting a node does not assert reasoning. Frame headings are containers, not endpoints for new semantic claims, so their child forms omit the reason choice. Legacy `causal`, `motivates`, and `aims_for` connections have canonical interpretation for new menus without silently rewriting saved content.

The canvas shows one visible route per node pair. A semantic connection replaces a redundant parent line in the Map editor. Existing connection records remain distinguishable through their saved details.

Point to a node selects **one** ordinary node from a map both participants can access, including an accessible third-party map. Alternatively, the author can create a new node on one of their shared maps and choose its frame. The form explicitly says that submitting creates and references this node. Selecting an existing reference does not endorse, copy, or merge it.

Records capture classification, source wording, and referenced wording. Changed or unavailable material is identified; stale submissions are rejected. Revoking sharing must not expose a private reference or its saved wording through an interaction or a descendant response.

## Recording versus applying

Recording Agree or accepting an interaction does not automatically edit a map. A separate **Review…** action previews a change to the owner's comparison map, and **Apply to my map** commits it. The source author retains control of the original map.

| Recorded choice | Optional reviewed application |
| --- | --- |
| Agree a node | Create an independent node or use an existing node; optionally link counterparts |
| Agree “For my own reason” | Use a referenced own reason, or add an independent reason, and connect it to the agreed-with node |
| Agree a typed semantic connection | Copy both endpoint nodes and their typed connection independently |
| Accept / Partly accept a proposal or dispute | Revise the owner's node wording or semantic connection note |
| Accept an offered reason | Create or select an owned node; connect it as a reason to the owner's target node |
| Answer a reason request | Optionally add the answer as a reason on the owner's map |
| Answer an explanation request | Optionally revise the owner's explanation after review |

Organizational edges do not offer unsupported copy or wording-revision operations. Application receipts prevent repeated submission from creating duplicates. Applications recheck the reviewed interaction and sources. Copies retain independent authorship and their original frame by default; they do not merge identities or transfer the source author's confidence.

**Edge-targeted offered reasons:** the interaction remains attached to the precise original edge. After accepting, the recipient can optionally add or identify a node on their map. This prototype does not invent a node-to-edge inference or an arbitrary substitute node-to-node connection. A fuller representation of reasons supporting connections remains future design work.

## Retained and deferred features

- Counterpart requests and create/choose counterpart flows remain in Compare. Request counterpart is unavailable when a counterpart is already linked.
- Confidence remains author-controlled through the persistent node slot and creation/edit forms. Philosophy retains a reusable bank of definitions, standards, principles, beliefs and other foundations, with versioned references on nodes.
- Old Ask functionality is replaced in the new workflow by Inquiry's request menus.
- Standalone adoption suggestions, reflection/outcome entry tools, generic Resolve/Reopen, and old challenge/reply menus are not new grammar actions. Historical records and underlying model checks remain for compatibility. The separate standstill family above does not rename or reactivate those historical records.
- The narrow standstill workflow is implemented locally; broader resolution, automatic verdicts, Pod convergence, dragging/rearranging, Likely Future filtering, merging source records and automatic adoption remain deferred. The released joined agreement cards are a display projection, not merged source ownership.

## Original v4 implementation and verification boundaries (historical)

### Original local testing checklist

Open `review/Harmonious-interactions-preview.html`. Use **Preview as** to switch between Alex and Blair. These are disposable sample identities, not signed-in accounts. Reopening resets the samples; Download backup retains a copy of your experiments.

1. As Alex, select a Blair node and switch among Compare, Inquiry, and Argument. Confirm each mode offers its own actions and that an unfinished form returns when you revisit its mode.
2. In Compare, record a position. Confirm it stays attached to the source and leaves both maps unchanged. Agree can separately preview a copy into your map; its default frame matches the source.
3. In Inquiry, send a request, proposal, or offered reason. Switch to Blair while viewing it, choose Respond, and select one outcome. Acceptance alone should leave the map unchanged; Review and Apply perform a separate owner-controlled edit.
4. In Argument, inspect nodes in all three frames and the sample typed connections. A sample citation adds source-related grounds. Other opens a text field, and no internal Signals labels appear.
5. Try Point to a node with no selection, one existing selection, and a newly created node. Confirm only the explicit option to create a node adds it to your map.
6. Collapse a branch containing interactions and open its count badge. Check that the attached conversations remain reachable. In Maps, use Add child node with Organization only, then create another child with the reason-to-parent choice; check the direction and single visible connection. Cancelling an unfinished child should add nothing.

- `dist/interaction-grammar.mjs`: vocabulary, target-derived menus, Signals, references, recipient and edit validation.
- `dist/interaction-ui.mjs`: source actions, grouped forms, responses, and interaction lists.
- `dist/interaction-application.mjs` and `dist/interaction-application-ui.mjs`: reviewed owner-controlled map changes and receipts.
- `dist/discussion-ui.mjs`: canvas attachments and mode integration. The Map editor uses `dist/model.mjs`, `dist/app.mjs`, and `dist/node-actions.mjs` for nodes and typed connections.
- `supabase/migrations/20260923002452_interaction_grammar_v4.sql`: applied database-side checks. Database tests exercise it in a disposable database. The original local timestamp was renamed to match the connector's applied history.

Active browser suites are `map-grammar-browser`, `interaction-grammar-browser`, `interaction-retry-browser`, `confidence-browser`, and `counterpart-browser`. They cover Map creation, typed reasons, modes/drafts, minimal submissions, recipient responses, source Add-ons, hidden tags, references, explicit application, counterpart independence, persistence, narrow screens, lost save acknowledgments, and concurrent edits. `interaction-grammar.test.mjs`, `interaction-application.test.mjs`, and `interaction-database.test.mjs` cover model/account behavior, source freshness, ownership, privacy, and application identity. The database suite compares SQL options/tags with the client grammar and checks direct write enforcement.

`package.json` explicitly records retired browser suites in `harmoniousLegacyBrowserTests`; `scripts/verify.mjs` excludes those named suites from discovery. Their source history and applicable lower-level tests remain:

| Retired browser suite(s) | Replacement or retained coverage |
| --- | --- |
| `inquiry-browser` | Implemented interactions replace the blank placeholder; `interaction-grammar-browser` |
| `navigation-browser`, `discussion-browser` | Map and interaction walkthroughs replace old type selectors and Ask/Challenge/paired-judgment forms |
| `premise-browser` | Map/Create reason plus optional Point to node; premise model/account checks remain |
| `adoption-browser` | Reviewed explicit application in the interaction walkthrough and application model tests |
| `reflection-browser`, `stabilization-browser` | Standalone reflection controls deferred; reflection/account and other focused checks remain |
| `reasoning-browser`, `reasoning-navigation-browser` | Old contribution forms replaced; reasoning layout/projection/search model checks remain |

The complete 44-check run passed, including all five active browser suites, the standalone preview's request/response flow, database checks, and the Worker build. Retiring a suite does not imply every historical screen has been revalidated under the new UI. Worker version 41 and its migration are live; all existing stored records matched their pre-deployment checksum.

See [protected baseline preparation](interaction-redesign-preparation.md) for the stable tag and source backup. Source rollback is not a database rollback. Once new grammar interactions are stored, prefer a forward fix over the older Worker, which cannot read their format. Older open tabs must reload; the new Worker checks client capabilities before serving or accepting unsupported records.

## Facilitated entry

Facilitator mode, live in Worker 62, preserves the existing interaction grammar. An enabled test participant remains the author; the signed-in organizer is separately recorded as operator. Every published facilitated decision requires explicit direction for that participant. Private drafts are limited to wording proposals and are absent from agreement and Argument projections until exact approval. No facilitated entry supplies both people's decisions, creates implicit agreement or changes standstill confirmation eligibility. See [the workflow](facilitator-mode-plan.md) for supported actions and limits.
