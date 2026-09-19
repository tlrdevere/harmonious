# Existing positions used as reasons

Prepared September 19, 2026. [Deployment status](deployment-status.md) records the live version and verification evidence. This increment implements the first priority from the [process review](process-design-review-2026-09-19.md); it does not turn the source maps into an arbitrary shared graph.

## Interaction

In Argument, **Explain my reasoning** and **Add supporting reason** offer two choices inside the same form: **Write a reason** or **Use one of my nodes**. Compare remains the place for inquiries and information requests.

The picker searches ordinary Position nodes in the author's map participating in the Comparison, in the same frame as the conclusion's context. Names and parent paths distinguish similar claims. The conclusion remains visible while choosing. A response anchored on the other person's map can use the author's own map in that matching frame; when both compared maps have the same owner, the anchor's map is used.

The selected position is read-only in this form. Its title becomes the reason's statement; its summary, details, source reference and invoked definitions are preserved in the reviewed source. Editing the position belongs in its map. There is no additional explanation field in the first reference form; further supporting reasons and responses can explain the use.

The reason card's definition icon opens only those invoked versions. Tall forms leave the Argument navigation controls reachable and scroll within the remaining canvas space. Switching modes parks the draft; it does not save or discard the selected position.

A position may support distinct conclusions through distinct authored uses. The same placement cannot be added twice to the same conclusion while the first use is active. Direct self-support, repeated premises in a support chain and cycles in the recorded support dependencies are excluded. This is a structural constraint, not a claim that the argument is sound; logical objections still belong in Argument's Challenge flow.

## Saved meaning and later changes

Each referenced reason remains a `discussion` with `kind: argument` and `action: reason`, one immutable conclusion target and one optional `premise`:

```text
premise = {
  mapId, nodeId, ideaId, ideaVersion,
  wording: { kind, title, summary, details, timeScope, sourceTitle, sourceUrl, frame },
  contexts: [{ id, authorId, version, body, definitionRefs }]
}
```

`mapId` and `nodeId` identify the existing placement. Wording and explicitly invoked source contexts are pinned inline so both participants can read what was used even when a historical idea version is no longer present in their account projection. Unused library definitions do not travel with the reference. Confidence is excluded from wording identity.

The app does not create another map node, move the existing node, add a map relation or infer the other person's endorsement. The Argument card is one use of the position in a particular conversation. A reason's presence or absence of a premise cannot change after creation, and its source placement cannot be silently replaced. Withdraw the use and create a new one if a different source is intended.

Later source edits mark the use as needing review and also affect health warnings farther along the argument. The saved statement is not automatically rewritten. The author can inspect old/current wording and explicitly accept the new source. That creates a new reason version and retains the previous reference in history. The idea identity can change during review because adapting a linked node may give that same placement a new idea identity.

Source removal or movement outside the relevant frame leaves the pinned historical use readable. Fresh use is blocked when the source is unavailable. Authors can still withdraw a contribution without smuggling other changes into that withdrawal. If a compared map becomes inaccessible, the shared conversation follows the existing access rules and disappears from the affected participant's projection.

Unavailable referenced sources also block fresh reasons, challenges and responses farther down that reasoning ancestry. Changed wording alone remains a review notice, not an automatic rejection of the argument. A source or conclusion moving frames while the picker is open refreshes the eligible choices instead of repeatedly asking the author to accept an invalid selection.

## Save and validation boundaries

Referenced creation/review stays staged until the server acknowledges the saved choice. The fresh read is compared against the preview; a changed source requires explicit review while keeping the form. A retry checks for its previously saved contribution before attempting another use. An account change, revision conflict or network error cannot be treated as a successful save.

Browser/server validation and an additive service-only database trigger check authored identity, source ownership, same-map/frame eligibility, exact current snapshots on creation/refresh, historical shape, duplicate uses and support cycles. Historical validation does not require the original source to still exist. Contextual reply/challenge links are used to locate a frame but are not themselves Supports dependencies.

The applied migration is [`20260919060236_existing_node_reasons.sql`](../supabase/migrations/20260919060236_existing_node_reasons.sql). It adds three SECURITY INVOKER functions with empty search paths and service-role-only execution, without rewriting stored records. The CLI-created source filename was reconciled to the database connector's applied version.

Preserved history is immutable. Newly appended intermediate reference snapshots must match the prior saved source or the exact current capture; they cannot introduce invented earlier wording. The browser saves each reviewed refresh immediately rather than accumulating several different unsaved source versions.

Portable schema **5** retains readers for older workspaces. `comparison-premise-v1` protects reads and writes involving a premise, including historical references. Unaffected older clients receive the envelope they understand; affected clients get the existing update-required recovery message before changing saved work. After references are saved, prefer a forward fix to a Worker rollback that predates this capability.

## Scope and acceptance

Verify two-account creation, unchanged source maps, scoped search, distinct conclusions, linked statement versus Supports challenges, source changes and explicit review, deletion and withdrawal, confidence-only changes, invoked definitions, retries, incompatible clients, portable reload, and narrow-screen/mode-switch drafts. Direct database attempts to forge wording or retarget a saved source must fail atomically.

Cross-map premise sharing outside the Comparison, cross-frame support, reusing a free-text conversation reason as a new worldview position, arbitrary graph links and a single drawn card with several Supports edges remain separate work. The first version retains one attached Argument card for each authored use. Compass placement, disagreement outcomes and the additional inquiry preset are not part of this feature.
