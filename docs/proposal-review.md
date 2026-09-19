# Proposal revisions and clarification

Implemented locally September 10, 2026. Not deployed. This builds on [durable overall Comparisons](overall-comparisons.md) and supplies the review state that a separate Argument view will need.

## What users can do

Each proposed correspondence now has a numbered version containing its proposed question and saved sources. The form shows the current version and preserves earlier versions in **Proposal and judgment history**. A person adding their first judgment starts with the proposed question filled in; they still choose their own question/answer judgments.

The proposer can revise the proposed question. The other owner can record a differing interpretation in their own judgment, or start another proposal; their answer does not overwrite the original proposed question. Reviewing changed source wording, context or connections creates a new version too. Both owners must review that version before agreement is displayed. As before, changing which nodes are paired after the other person has judged them requires a new proposal.

**Clarify your positions** gives each person a response field. They read the other source position and answer the proposed question in their own words. Both saved responses are shown with attribution. This can begin while the question relationship still needs elicitation; it does not require declaring the answers divergent first.

After both responses are recorded against the current proposal, each person can check **After reading both responses, I confirm that our positions still differ on this question** and save their judgment. The control is available only for a same-question/apparent-divergence judgment. The shared state becomes **Divergence confirmed after clarification** only when both independently confirm the same current responses and agree on the divergent answer relationship.

Changing a response invalidates the other person's previous confirmation. Even changing it back to identical wording creates a new response revision and requires fresh review. Changing the proposed question or sources also invalidates prior review. Saved judgments and confirmations remain in history; they are not rewritten or deleted. Original worldview nodes remain unchanged by these actions.

## Data and authorization

- `proposalVersions` is an append-only array on the existing proposal record. Each entry has a consecutive revision, author, timestamp, proposed question, source node IDs and source snapshots. The latest entry describes the current source snapshots. New question revisions belong to the proposer; either participant may record a review of changed sources.
- Each judgment records `proposalRevision`, `elicitationResponse`, `responseRevision`, `divergenceConfirmed` and `reviewedResponses` alongside its existing statuses, notes, snapshots and history. Only that judgment's author can change these fields.
- `reviewedResponses` pins both participants' response text, response revision and proposal revision. Confirmation is derived from current records rather than a mutable shared flag. Downstream Argument code should use `comparisonElicitation(workspace, record).state === 'confirmed'`, not the historical `provisional` field or the general **Both agree** badge.
- The Worker rejects rewritten proposal history, fabricated changes to another person, invalid revision references, stale response confirmations and altered saved judgment history. Multiple locally recorded edits before autosave retain their sequence. The existing record revision checks handle simultaneous edits without overwriting the other participant.
- Older records get a logical version 1 from their saved question and snapshots. Older judgments without an explicit proposal revision require review. Earlier versions that were never separately recorded cannot be reconstructed; their existing historical records remain untouched.

This adds fields to the existing JSON records and needs no additional SQL migration beyond the pending overall-Comparison migration. It requires the matching new frontend and Worker; old clients must reload. No live database or deployment changes were made during this work.

## Validation and remaining work

The application, account, PostgreSQL and generated Worker checks pass. Regression tests cover two-person confirmation, changed/restored responses, changed questions and sources, preserved history, portable round trips, batched autosaves, unauthorized changes and the form's confirmation controls. The standalone preview also exports successfully. Visual browser verification and a live two-account acceptance flow remain pending because local-preview access was blocked by browser URL policy in the preceding work.

This is a minimal clarification workflow, not a facilitator or a judgment that the responses are substantively adequate. It does not yet provide multiple independent elicitation prompts per proposal, invitations, notifications or reasoning nodes. The next slice is the separate Argument view: linked grounds, evidence, values and rebuttals over the selected Compare proposal, preserving the proposal/source references established here.
