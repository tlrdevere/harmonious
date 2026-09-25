# Interaction grammar v4

Implemented on `redesign/node-interactions` and deployed to the live beta at the owner's request on September 23, 2026 at 00:25 UTC (September 22 in New York). The database migration is applied; see [deployment status](deployment-status.md). The optional portable review file remains `review/Harmonious-interactions-preview.html`. All **44 active release checks passed** on September 22, 2026; report: `build/verification/2026-09-22T22-53-25-909Z-38200/summary.json`.

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
- “Other” opens a free-form field wherever offered, including Endorse. Writing in that field is optional. Other does not infer a disagreement classification.
- Each selected dispute option's Signals tag is saved internally with that option. Tags and the Notes column are not UI text. “What it becomes” remains provisional; the reviewed application behavior below defines the implementation.

## Modes and responses

| Place | Actions | Scope |
| --- | --- | --- |
| Map / Create | Add node, Create reason, connect nodes, edit wording and sources | Author's own map |
| Compare | Endorse, Disagree, No position | Another participant's ordinary node or connection |
| Inquiry | Request reason, Request explanation, Propose alternative, Offer reason | Another participant's ordinary node or connection |
| Argument | Dispute reasoning | Another participant's ordinary node or eligible typed connection |
| Within the originating mode | Respond | Intended recipient of an active request, proposal, offer, or dispute |

Map editing retains its Maps destination. Compare, Inquiry, and Argument share a comparison canvas, source maps, and camera. Changing modes parks an unfinished form; returning restores it. Changing targets or leaving the form uses the discard safeguard.

**No position** withholds a stance rather than asserting disagreement. Its choices are “I don't know,” “I need more information,” “I haven't considered this,” and Other. Counterpart links identify comparable nodes independently of anyone's stance. Endorse, Disagree, and No position do not automatically create, remove, or merge counterparts.

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

Create reason adds a node beneath the selected node and an explicit `reason` connection from child to conclusion. Merely nesting a node does not assert reasoning. Frame headings are containers, not endpoints for new semantic claims. Legacy `causal`, `motivates`, and `aims_for` connections have canonical interpretation for new menus without silently rewriting saved content.

The canvas shows one visible route per node pair. A semantic connection replaces a redundant parent line in the Map editor. Existing connection records remain distinguishable through their saved details.

Point to a node selects **one** ordinary node from a map both participants can access, including an accessible third-party map. Alternatively, the author can create a new node on one of their shared maps and choose its frame. The form explicitly says that submitting creates and references this node. Selecting an existing reference does not endorse, copy, or merge it.

Records capture classification, source wording, and referenced wording. Changed or unavailable material is identified; stale submissions are rejected. Revoking sharing must not expose a private reference or its saved wording through an interaction or a descendant response.

## Recording versus applying

Recording Endorse or accepting an interaction does not automatically edit a map. A separate **Review…** action previews a change to the owner's comparison map, and **Apply to my map** commits it. The source author retains control of the original map.

| Recorded choice | Optional reviewed application |
| --- | --- |
| Endorse a node | Create an independent node or use an existing node; optionally link counterparts |
| Endorse “For my own reason” | Use a referenced own reason, or add an independent reason, and connect it to the endorsed node |
| Endorse a typed semantic connection | Copy both endpoint nodes and their typed connection independently |
| Accept / Partly accept a proposal or dispute | Revise the owner's node wording or semantic connection note |
| Accept an offered reason | Create or select an owned node; connect it as a reason to the owner's target node |
| Answer a reason request | Optionally add the answer as a reason on the owner's map |
| Answer an explanation request | Optionally revise the owner's explanation after review |

Organizational edges do not offer unsupported copy or wording-revision operations. Application receipts prevent repeated submission from creating duplicates. Applications recheck the reviewed interaction and sources. Copies retain independent authorship and their original frame by default; they do not merge identities or transfer the source author's confidence.

**Edge-targeted offered reasons:** the interaction remains attached to the precise original edge. After accepting, the recipient can optionally add or identify a node on their map. This prototype does not invent a node-to-edge inference or an arbitrary substitute node-to-node connection. A fuller representation of reasons supporting connections remains future design work.

## Retained and deferred features

- Counterpart requests and create/choose counterpart flows remain in Compare. Request counterpart is unavailable when a counterpart is already linked.
- Confidence remains author-controlled. Definitions and standards retain their central library and invoked references on the map.
- Old Ask functionality is replaced in the new workflow by Inquiry's request menus.
- Standalone adoption suggestions, reflection/outcome entry tools, generic Resolve/Reopen, and old challenge/reply menus are not new grammar actions. Historical records and underlying model checks remain for compatibility.
- Dragging/rearranging, Likely Future filtering, merging nodes, termination status, and automatic adoption remain outside this prototype.

## Implementation and verification boundaries

### Local testing checklist

Open `review/Harmonious-interactions-preview.html`. Use **Preview as** to switch between Alex and Blair. These are disposable sample identities, not signed-in accounts. Reopening resets the samples; Download backup retains a copy of your experiments.

1. As Alex, select a Blair node and switch among Compare, Inquiry, and Argument. Confirm each mode offers its own actions and that an unfinished form returns when you revisit its mode.
2. In Compare, record a position. Confirm it stays attached to the source and leaves both maps unchanged. Endorse can separately preview a copy into your map; its default frame matches the source.
3. In Inquiry, send a request, proposal, or offered reason. Switch to Blair while viewing it, choose Respond, and select one outcome. Acceptance alone should leave the map unchanged; Review and Apply perform a separate owner-controlled edit.
4. In Argument, inspect nodes in all three frames and the sample typed connections. A sample citation adds source-related grounds. Other opens a text field, and no internal Signals labels appear.
5. Try Point to a node with no selection, one existing selection, and a newly created node. Confirm only the explicit option to create a node adds it to your map.
6. Collapse a branch containing interactions and open its count badge. Check that the attached conversations remain reachable. In Maps, create a node and a reason; check the direction and single visible connection.

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
