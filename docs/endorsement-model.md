# Endorsement model — first prototype

This iteration implements the user-approved bridge from deliberate reuse of shared nodes toward automatic consensus views. Personal maps and authored reference maps are separate objects. Pods are derived from explicit co-sign records. Authorship and copying alone supply no endorsements.

## Three actions

| Action | Wording identity | Membership effect |
| --- | --- | --- |
| Co-sign, optionally add to my map | Keeps the selected shared identity and version | Records the selected participant’s endorsement |
| Copy and adapt | Creates a new identity, retaining source identity/version attribution | No endorsement is inferred |
| Endorse a section or map | Records an explicit checklist of existing node versions and selected structure | Each checked node receives that participant’s co-sign; no future content is included |

A frame heading is navigation and context. It cannot be co-signed. Co-signing a question expresses shared inquiry, not assent to an answer. Single-node co-signing includes that node’s wording, explanation, and source fields; it does not endorse surrounding nodes. Cross-map relationships and adjacency are not inferred from identical wording.

## Identity, context, and change

Each node occurrence has its own map-local ID and parent. The shared wording ID and version can appear in multiple maps. Shared versions include frame, kind, title, summary, detailed context, time perspective, and source fields. Personal confidence stays local. Equivalent-looking independent nodes are not silently merged.

An original wording edit appends an immutable version. Linked occurrences stay pinned. Editing a linked occurrence starts an attributed independent wording identity. Copying an entire map does the same for its content, keeping the map’s authorship separate from the source’s.

An endorsement retains its selected versions and source/target references. Editing, adapting, or removing an affected source/personal occurrence flags its entry for review. Current membership counts exclude affected entries; prior versions remain in history. A section or map changing shape also gets a review flag, while unchanged individual wording co-signs remain attached to their recorded versions. Whole-section confirmation is never inferred from those per-node counts.

Reviewing records a fresh, explicit selection and supersedes the earlier record. New content is initially unchecked during review. Withdrawal keeps the historical record and the copied map content; other active co-sign records can still apply. Repeated records never multiply a person’s membership count.

## Derived views

A chosen reference or personal map provides layout context. Users select the population and the minimum number of people required per node. Structural ancestors can remain visible to preserve orientation, labeled “Context only.” The view does not claim that the underlying guide-map edges are themselves universally endorsed.

Each node has its own membership set. Selecting several nodes calculates the intersection of those sets. This supports overlapping and nested groups without treating popularity on each node as agreement by one consistent group. An empty universal core is valid. Unrecorded positions are not labeled as disagreement.

## Scope of this iteration

Co-signs are recorded by a facilitator for named participants inside one workspace. They are not verified participant signatures, organization endorsements, or public account identities. Popularity is based on current workspace records. Example maps are illustrative and start with no co-signs.

This version provides a source-map-guided pod view. It does not yet invent a universal structure across independent maps, infer semantic equivalence, establish organizational authority, or implement public trending, multi-user identity, cross-elicitation, or reconciliation. Those remain subjects for testing and further design.

The portable HTML saves all data in an explicit workspace JSON download. The hosted implementation saves the same validated schema in the existing private D1 workspace. Saving a Site version does not publish it.
