# Compare and Argument: interaction and navigation rules

Updated September 19, 2026 following the owner's clarification: **Compare is for understanding and relating worldviews; Argument is for evaluating and critiquing them.** This supersedes earlier designs that exposed challenges directly in Compare. Both remain modes of the same saved Comparison.

## The two modes

| Selected item | Compare | Argument |
| --- | --- | --- |
| Another person's position | **Ask**: explanation, example, evidence, or own question. Inspect the author's definitions and confidence. | **Challenge** the statement. Read its reasoning and inspect the author's definitions and confidence. |
| Own position | Set confidence; invoke definitions; request a missing counterpart; suggest adoption where appropriate. | **Explain my reasoning**; add supporting reasons; set confidence and invoke definitions. |
| Two positions, one from each map | Record **Agreement / Disagreement**, or identify counterparts. These are attributed descriptions of their relationship. | Evaluate either statement or its reasoning. Existing relationships remain visible as context. |
| Source-map connection | Ask what the connection means or request an explanation; inspect definitions. | Challenge the connection's meaning or justification. |
| Supports connection | No critique tools. Use Argument to inspect this reasoning structure. | Inspect the reason and conclusion, then **Challenge reasoning**. Preserve the difference between disputing a statement and disputing what follows from it. |
| Recorded agreement/disagreement | Read attribution, ask for clarification, or manage one's own recorded wording. | **Contest agreement/disagreement** with a stated objection. This is a critique of the recorded relationship, not an ordinary reply. |
| Question or request | Answer/respond in its conversation, preserving the original target. | Earlier questions can appear as context when required to understand an argument. Fresh inquiries are composed in Compare. |
| Reason, challenge or argumentative response | No critique form or expanded argument cards. The Argument mode remains the route to this work. | Follow the argument, respond, add one's own reasons, and use the existing attributed outcome controls. |

Recording disagreement in Compare does not itself create an argument. “These positions differ” describes a relationship; “this inference is invalid, because…” evaluates reasoning and belongs in Argument. Asking for evidence requests information; challenging the adequacy of that evidence evaluates it. The mode and selected action express that intent; the app does not guess it from the words typed.

Confidence and invoked definitions are context about a claim, so they remain readable in both modes. Authorship and edit permissions remain the same in either mode.

## Keep the canvas quiet

The mode switch determines the main actions and which conversations are displayed. An Arguments display toggle must not turn Compare into an argument editor. Compare shows question/request indicators; Argument shows reasoning/challenge indicators, including their collapsed counts. Hiding detail never deletes saved work.

Keep existing map positions, zoom, selection and personal folds when switching modes. A source selected in Compare should still be the source selected on entering Argument. Opening an existing critique should take the person to Argument with its real context. A saved question can remain readable as an ancestor of a challenge without showing unrelated questions throughout the Argument canvas.

An unfinished form belongs to its mode. Switching away parks it in memory and hides it; switching back restores it. Selecting a replacement target still uses the explicit discard decision. A mode switch must neither submit the form nor silently lose it. The one-draft limitation across targets/Comparisons and the lack of draft persistence across reloads remain explicit.

Only show actions valid for the selected item and author. Empty headings disappear. Management actions stay secondary. A node's normal face carries its content, owner and small relevant indicators, not a permanent toolbar of every possible operation.

## One challenge form, optional classification

The entry point is **Challenge**. The form identifies the statement or connection being addressed, then gives the user a text field to explain the problem. The explanation is the important content.

Put **Type of challenge (optional)** in a collapsed section. Retain the existing useful choices: general challenge, reasoning does not follow, counterexample, and logical fallacy or reasoning error. A user can name a specific fallacy and explain its application in the text. No long catalogue, separate fallacy toolbar, required classification step, or extra kind of canvas node is needed for this increment.

These labels record the contributor's assessment. The interface must not present a fallacy accusation as an automated finding. Unsupported inference, contradiction, and other reasoning objections can be described under the same challenge mechanism; their details do not need rival top-level actions. Older saved categories remain readable without being promoted into the default menu.

Evidence/reference URLs and invoked definitions stay optional, secondary details. Supporting one's own claim is a reason action. Contesting a relationship is a targeted challenge. Neither action should be mixed into a general list of “reply/support/evidence” buttons on every item.

## Sorting should match the task

| Surface | Default order and scope | Why |
| --- | --- | --- |
| My maps | Most recently updated map first; name and stable ID break ties. | Returning to recent work is the usual task. Missing timestamps use a predictable fallback. |
| Saved Comparisons | Most recent saved activity first, including contributions and responses, not just creation time. Stable title/ID ties. | A newly active existing Comparison should be easy to find. |
| Find a map | A list of accessible maps ordered by name, with search by map/person. Compass is an alternate view of that same set. | Discovery should be predictable without a hidden popularity or ideological ranking. |
| Compass | Spatial self-placement; selecting a point opens its preview. Unplaced and overlapping maps remain reachable through List. | Location is a browsing aid, not a truth score, recommendation score, or reason to hide a map. |
| **Conversations** index | Recently active top-level conversations first, within the current mode. | Find ongoing work quickly. Responses contribute to their conversation's activity. |
| Inside a conversation | Original contribution followed by its follow-ups in stable creation order; preserve parent references. | Reading a discussion requires its sequence. Editing old wording must not move it to the end. |
| Argument canvas | Source/Supports/response relationships and stable sibling order. | The graph should explain reasoning, so never reorder it by confidence, newest update, or popularity. |
| Find in argument | Argument contributions and their necessary context; recent matching activity first. Keep **All / Open challenges** initially. | Search is for reaching a contribution, not rearranging the graph. Showing a result reveals its real ancestors and target. |

Do not add a sort selector to every surface. Establish useful defaults first. A later Name/Recent activity switch can live in the Library if testing demonstrates a need; it does not belong on the canvas. Keep one contextual search field, and avoid a wall of filters for authors, kinds, outcomes and dates before users need them.

The existing no-selection Argument overview can still group open challenges before resolved ones, then reasons. That is an explicit status summary, distinct from the **Conversations** index and from graph order.

Creation actions belong outside matching search results. A Start/Create card must not be counted as a matching Comparison or prevent an honest “No matching work” result. Summary counts should use actual roles: reasons are not challenges; questions plus counterpart/adoption requests are **Questions & requests**; earlier proposal-based work is labelled separately. A count of arbitrary children is **follow-ups**, not necessarily replies. Omit empty categories where practical.

Do not introduce “unread” or “needs your response” labels until the application actually tracks reading and can determine who owes a response. The existing Refresh workflow remains distinct from sorting by the latest saved timestamp.

## Apply the same rules to the next features

### Reuse an existing node as a reason

Keep this inside the existing **Explain my reasoning / Add supporting reason** flow in Argument. Offer **Write a reason** and **Use one of my nodes** there, rather than adding another button to every card.

Begin by searching the author's positions in their map already participating in this Comparison, identify each result by wording plus frame/parent path, and show the destination conclusion before saving. The author deliberately chooses a source; the app must not automatically choose a nearby or high-confidence node. Use a bounded, searchable list and a clear empty state. Pulling from another owned map is a later extension that requires explicit sharing and access-loss rules; merely finding a private node must not reveal it to the other participant.

Reference the existing position's identity and reviewed wording/version. It remains that person's position; it is not silently copied, jointly endorsed or moved to a new parent. Reuse under multiple conclusions and the distinction between a staged reason and a committed worldview position require the data design described in the [process review](process-design-review-2026-09-19.md). Revisit the process document's within-frame restriction explicitly before allowing an existing position from another frame; do not silently turn a causal or Addresses connection into a Supports connection.

### “What would change your mind?”

Add this as an optional **Ask** preset in Compare, using the same inquiry card and response flow. It does not need a new toolbar, node kind or required questionnaire. A response may later provide context for an Argument. An absent answer must not automatically become a values classification or a judgment of bad faith.

### Point of disagreement and outcome

In Argument, attach these to the selected statement or inference. Avoid a separate registry screen or duplicate free-floating card by default. A marked disagreement can have a short description and optional type, with clear authorship. Several specific points may exist beneath one broader disagreement.

An outcome should record whose assessment it is and what remains: a changed position, further evidence/work needed, or a difference understood. The app should not infer mutual agreement from one person's outcome or automatically change either source map. The existing challenge acceptance/resolution controls must remain distinguishable from a future outcome for the overall disagreement.

Begin with a small outcome note and an optional next-step field. Do not build scheduling, task assignment, automatic evaluation, or a research dashboard into that first form.

## Verification boundary

For this UI correction, verify both presence and absence: Compare has Ask and appropriate relationship/request actions, but no challenge/fallacy composer or critique list; Argument has target-specific critiques and reasons. Old contributions and their histories must remain reachable through the correct mode. Verify node, source-edge, Supports-edge, relationship and reply targets, owner permissions, mode-switch drafts, refresh, and narrow layouts.

The distinction is a UI/navigation rule over existing shared records, not a new access-control boundary or database split. Keep validation, source snapshots and authorship intact. The compass, reusable premise records, new inquiry preset, located-disagreement records and overall outcome notes remain separately planned features until implemented and verified; see [deployment status](deployment-status.md) for what is live.
