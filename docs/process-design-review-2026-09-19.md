# Process design review and next UI work

Reviewed September 19, 2026 against the working web beta and the complete **Harmonious Process Design — Living Document, Draft 1** at `C:/Users/Acer/Downloads/Harmonious_Process_Design.md`. The source document was read without modification. Section references below refer to that document. The user's subsequent product decisions take precedence over its earlier workflow and architecture proposals.

This is a product gap review, not a claim that every process experiment or deferred feature should become a control in the prototype.

**Subsequent clarification:** Compare is for understanding, inquiries, information requests and relating maps; Argument is for reasoning and critique. The [interaction and sorting rules](compare-argument-ui-rules.md) now govern menus, lists, optional challenge categories and the placement of the next features. Earlier suggestions to expose challenges in Compare are superseded. The [deployment record](deployment-status.md) identifies the implemented release.

## Immediate work — implemented and deployed

The routing and confidence changes below passed 38 release checks and are live in the [04:58 UTC release](deployment-status.md). Later increments add existing-node reasons and [disagreement points and individual outcomes](disagreement-points-outcomes.md). The deployment record identifies their release status; compass and shared-premise work remain deferred.

### Connections should stay outside cards

The screenshot exposed a real routing defect: comparison relationships used a top-to-top curve regardless of the cards' relative positions. After folding a branch, an endpoint could become a visible ancestor, while the curve still crossed that ancestor's face.

The corrected routing uses suitable boundary ports and avoids the interiors of visible cards and counterpart placeholders. The relationship label sits on the resulting route. One visible connection per displayed node pair, the original saved endpoints, and access to grouped meanings are preserved. Folding, panning and zooming do not require manual rearrangement. This is a routing correction, not the deferred dragging feature.

### Make personal confidence visible and editable on the map

Confidence already existed as optional personal node metadata on a 0–100 scale. Before this pass the editor exposed only five presets, while imports accepted other valid percentages; opening a value such as 73 and saving could therefore lose that value. Compare did not display the score.

The release adds **My confidence** on one's own Position node, with a numeric percentage and **Not assessed**, plus a quiet score on assessed cards in Maps and Compare. The other person can read the author's score, but cannot change it. Zero and Not assessed remain different. Frame headings, topics and questions are not scored claims. Confidence on separate reasoning contributions is a later design decision.

The score describes the author's confidence in their own position. It is not a truth rating, agreement score, popularity count, forecast probability, or automatic input to anyone else's judgment. It stays local when wording is reused; an independently adopted copy starts unassessed. Changing confidence must not produce a new wording version or an earlier-source-wording warning. Keep saved historical snapshots intact when excluding confidence from wording comparisons.

## Optional compass discovery

**Recommended location:** Map Library → Comparisons & arguments → Find a map, with **List / Compass** views of the same accessible maps. It is not another main tab. Creating a Comparison remains an action after choosing maps.

The first version should be explicitly **self-placed**. A point represents a particular worldview map, not a permanent classification of its owner. An owner can place, revise or remove their own map using two labelled controls, with a visual point as feedback. Placement is optional; unplaced maps remain discoverable in the list. Clicking a point shows map name, owner and a preview, then the existing Compare flow asks which of one's own maps to use.

The economic/social dimensions are provisional pending the owner's answer. The two endpoints of each axis need plain-language definitions before implementation; a political label alone is too ambiguous. Do not rank matches by an unexplained ideological similarity score. Nearby and distant maps can both be useful conversation partners.

The existing beta shares maps with signed-in beta participants. A compass should use that same access scope and must not publish private maps or change visibility merely because someone places a point. Overlapping points need an expandable list; keyboard controls and a list alternative must make every map reachable without precise pointer placement. On small screens, put the selected preview below the chart.

Store an axis-definition/version identifier, coordinates, and explicit self-placement provenance with the owner's map. Versioning prevents an axis rewording from silently changing the apparent meaning of old placements. Server validation and access filtering must match map ownership. A future calculated position should be separate and clearly labelled, with an explanation; it should not silently overwrite the author's placement. No classification or calculation is part of the first version.

[Interactive design preview](design/map-discovery-compass.html) — fictional examples only; no account connection or saved live placement.

## What the process document adds

| Capability in the process design | Current coverage | Recommended next step |
| --- | --- | --- |
| Authentic own maps, three frames, ownership and selective sharing (§1–2) | Implemented. Maps start private and are opened deliberately from the Library. | Add short, optional guidance for a meaningful claim and the Goal State → Status Quo → Transformation workflow. Do not insert pre-endorsed beliefs. |
| Uncertainty/provisional positions (§2.8) | Optional author confidence is now editable and visible on map cards in Maps and Compare. | Test the score UI with existing accounts; keep separate from truth, agreement and forecast probability. |
| Match nodes across structures; invite a missing counterpart (§3.3–3.4, §4.1.1) | Neutral counterpart links, empty slots, requests, recipient-created or existing nodes, and no-position/not-applicable outcomes exist. Agreement/disagreement is independently recorded by an author. | Keep asymmetry distinct from disagreement. Continue testing cross-branch and collapsed matches for visual clarity. |
| Lazy peer elicitation (§5.1.1) | Compare: ask for explanation, example, evidence, a free question, or **What would change your mind?**. Argument: challenge a position or connection. Definitions/standards are reusable and explicitly invoked. | Test the editable preset and ordinary response flow. Do not automatically classify an absent answer as a values dispute. |
| Reuse existing positions as reasons (§2.2.1, §2.4, §5.3.4) | **Use one of my nodes** is implemented and deployed inside the existing reason form: a reviewed reference to an own Position in the participating map and matching frame. Separate uses can support distinct conclusions. See [existing-node reasons](existing-node-reasons.md) and the deployment record. | Test reference review and the distinction between a statement challenge and an inference challenge. Keep one shared card with multiple Supports connections deferred. |
| Locate the actual point of disagreement, including an inference (§5.2–5.3.4) | **Mark point of disagreement** attaches an authored description to a source node/edge, reason, Argument response or Supports connection. Small attachment counts replace extra graph cards. | Test discoverability and source identity. Optional facts/reasoning/values categories describe the author's assessment; they do not establish a shared classification. |
| Shared premises and converging reasoning (§5.3.4) | Source relationships and author-labelled contributions exist; there is no common-premise projection spanning both chains. | After premise reuse, show explicitly acknowledged shared premises without merging source identities. One person's Agreement label is not evidence that both acknowledged a premise. |
| “What would settle this?” and tools fitted to the disagreement (§5.3.1–5.3.4) | Free text, references and defined standards can capture some of this, but no dedicated evidence plan, inference check or value trace exists. | Start with optional prompts: evidence needed, missing inferential step, deeper value. Do not add every formal category to the default composer. |
| Honest outcomes and research tasks (§5.3.1, §5.7) | Each participant can record one current personal outcome per disagreement point, with optional changed-position/more-work/difference-understood label and next step. Earlier wording is retained. | Test separate attribution with different assessments from the two accounts. Neither assessment changes a map, claims mutual agreement, or resolves a challenge. Task assignment and scheduling remain deferred. |
| Conditional positions (§1.3, §4.1.4) | A person can write conditions in their wording; adoption lets them edit their independent copy. No structured qualifiers exist. | Preserve conditions in the text first. Add a dedicated “Under these conditions…” field only if prototype sessions demonstrate a need. |
| Change tracking and effects on reasoning (§5.3.3, §6.5) | Wording versions, source snapshots, history, access loss and changes through a reasoning ancestry are tracked. Reused positions now retain their reviewed wording and report source changes. General many-to-many dependency propagation is not implemented. | Improve source-review visibility and searchable pinned wording as identified in the [latest review](review-and-next-steps-2026-09-19.md). Do not calculate winners or infer that a challenged claim is false. |
| Short overview of a comparison (§4.1.3) | Library cards separate relationships, questions/requests, reasons, challenges, points and individual outcomes, with empty counts omitted. Comparisons sort by saved activity. Outcome records now exist, but the Library has no grouped assessment overview. | Group points with their separately attributed outcomes inside the existing conversation list. Avoid a new dashboard, speculative unread labels or treating all work as awaiting a response. |
| Participant/facilitator materials (§1.3, §6.4) | User testing and workflow documentation exist; they are not a complete participant introduction or facilitator guide. | Prepare a brief first-session guide and worked fictional exchange once the UI settles. Keep process guidance separate from authored worldview content. |

## The important architecture decision

The document describes **one integrated graph**: an ordinary worldview position becomes a reason when it supports another position. The beta currently uses worldview nodes plus Comparison-local reasoning contributions. The two modes share the Comparison, but their data is not yet the fully integrated graph described in §2.2.1 and §5.3.4.

The source itself also permits a shared staging area before someone commits content to their individual map (§4.1.4). That provides a useful bridge: keep questions, challenges and uncommitted reasoning as conversation, while allowing an author to deliberately use existing owned positions or commit a new reason to their own map. The current recipient-controlled adoption flow is related but does not solve reuse of reasoning by its own author.

The [existing-node reference design](existing-node-reasons.md) now specifies stable identity, pinned wording and invoked definitions, author-controlled review, source loss, separate uses under multiple conclusions, compatibility and cycle checks. It preserves the distinction between an existing worldview position and a Comparison-local use of that position as a reason. This does not migrate all discussion records into one graph or create arbitrary cross-frame links. A reason's statement and its Supports connection remain separate critique targets.

## Earlier instructions not being reinstated

- The document requires a shared question before agreement/disagreement. The current prototype deliberately does not: the user asked to relate nodes first and elicit questions when useful.
- The document gates confirmed convergence on multiple endorsements. Current relationship labels are a named user's recorded judgment, sufficient to draw the relationship. They do not automatically merge nodes or claim bilateral consent.
- Pods are described as derived in the older document. The user subsequently reopened that question, so pod authoring/derivation remains undecided.
- Several layouts and semantic edge meanings appear in the document. Preserve one visible edge per displayed node pair and accessible grouped meanings; do not reintroduce parallel lines.
- Automatic layouts remain responsible for legibility. Manual dragging/rearrangement is still deferred.
- Forecast protocols, philosophy/ontology, group thresholds, facilitator privileges, automatic matching and machine evaluation remain later work. A political compass is a new discovery idea, not an already-specified process requirement.

The source also contains internal evolution: Appendix A lists Grounds as a kind, while the June refinement explicitly says it is a position's supporting role. Some sections call maps trees while later sections allow shared nodes in a graph. These should be reconciled in a future version of the process design, not implemented as contradictory product rules.

## Suggested sequence after this UI pass

1. Test readable connections and author confidence with the two existing accounts, including folded branches and a narrow window.
2. Try the deployed **Use one of my nodes** in Argument, including explicit source review and the distinction between a referenced use and the original worldview position.
3. Test the new **What would change your mind?**, **Point of disagreement**, and personal outcome/next-step note in one complete exchange before adding more taxonomy or forms.
4. Finalize compass axes and implement optional self-placement within Comparison discovery.
5. Extend dependency review and shared-premise display as reasoning becomes reusable. Keep pods, dragging and automatic ideological placement on the later list.

Hosted CI and GitHub synchronization remain separate release-maintenance follow-ups. The dependency-audit disclosure preference in [dependency-review.md](dependency-review.md) is unchanged; this review does not run another registry audit.
