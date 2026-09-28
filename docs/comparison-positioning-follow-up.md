# Comparison positioning: owner feedback after Worker 48

Recorded September 28, 2026 from `harmonious 10.png` and `harmonious 11.png`. This diagnosis led to the [implementation plan](comparison-positioning-plan.md), now implemented and undergoing release verification. The findings below describe the preceding Worker 48 behavior; [deployment status](deployment-status.md) records publication.

## What the owner is seeing

- Comparisons with five or more children look less balanced than Create. In the SQ screenshot, two children sit above, two spread to the lower sides, and one sits beneath the frame; long bent routes emphasize that distribution.
- Unrelated nodes appear to be counterparts because the initial layout puts them directly beside one another. The owner wants a way to leave nodes unpaired and suggests unpaired-by-default placement with ghost counterpart positions and explicit links.

## Confirmed behavior in Worker 48

`dist/comparison-layout.mjs` assigns provisional slots by sibling-index paths, independently of meaning, titles, or saved counterpart records. Each slot has a position for each map. Matching sibling order therefore produces visual pairs without saving a counterpart relationship. Saved links can override those assignments.

Comparisons builds a joint slot tree, then stretches its radial coordinates by 1.8 horizontally and 1.3 vertically. Cards remain their usual size. The two-card offset also remains when one map's branch is collapsed. Create uses the single-map radial coordinates directly. Both layouts divide an odd number of children between upper and lower sectors; Comparisons adds the joint-tree and spacing effects. Worker 48 improved connection routing and selection stability while deliberately retaining this placement policy.

Link overrides also leave their vacated synthetic slots in the joint tree. Empty leaves can continue influencing spacing, and descendant slots retain their earlier synthetic parent paths when a displayed parent moves. This is another confirmed implementation limitation; the screenshots alone do not establish how much it contributes to those particular maps. The follow-up should rebuild occupied display groups and their necessary ancestry rather than merely reduce the scale constants.

## Recommended next increment

1. **Stop provisional pairing of ordinary nodes.** Sibling order, matching titles, and copied-map origins must not give unrelated nodes a shared pair position. Existing comparisons should also stop implying these unsaved matches. Preserve all real links, authorship, and history.
2. **Use an explicit unlinked state.** Give an unlinked ordinary node a compact ghost counterpart affordance labelled **No counterpart linked**, with **Link counterpart** opening the existing chooser. Prefer a small placeholder over duplicating every node with a full empty card, since full cards could make crowded maps much larger. Exact appearance is a design proposal for review.
3. **Distinguish requests from ordinary absence.** A ghost is a display affordance, not a node, saved request, assessment, or assertion that the other person has no position. A sent request retains **Counterpart requested** and its response state. Closed requests and **No position yet / Not applicable** must remain understandable.
4. **Place explicitly linked nodes together where appropriate.** Preserve the existing ownership rules for withdrawing links. After the last qualifying link is withdrawn, return to the unlinked display rather than filling the space with an unrelated neighbor. Do not suggest that a participant can delete another person's attributed link.
5. **Improve comparison spacing using Create as the reference.** Allocate space for the actual visible content and explicit pairs, then check four, five, six, and eight children; unequal maps; one map collapsed; and nested branches. Keep source parents intact and lines easy to trace. Removing provisional pairing alone is not proof that the crowded layout is fixed.
6. **Keep structural headings and exceptional links honest.** SQ, TA, and GS headings can remain alongside their corresponding headings without implying agreement. Multiple links, cross-frame links, and hidden/unavailable endpoints must not turn a known linked node into a misleading “No counterpart linked” ghost or duplicate the real node just to fill every pair slot. Existing historical pair judgments remain readable and require an explicit placement policy when removing provisional slots.

Selection, inspection, mode switches, and opening/cancelling the chooser must continue to preserve positions and the camera. Ghosts must not be mistaken for authored nodes by counts, navigation, export, or saved source data. Linking may deliberately rearrange the affected placement; it must not move source nodes to different parents.

Suggested exceptional labels include **Counterpart in another frame**, **Counterpart in a collapsed branch**, and **Linked elsewhere**, with access to the actual linked nodes. An unavailable endpoint needs an unavailable status: the current layout-facing link list filters those endpoints, so absence from that list alone cannot establish that no link was ever recorded.

## Order and boundaries

Prioritize this feedback before designing pair-specific **Aligned / In tension** assessments. The [implementation plan](comparison-positioning-plan.md) defines unlinked/linked visual states, comparison spacing, delivery order, and regression cases together. The pair-assessment design question remains next in discussion.

This feedback reopens the default comparison placement and spacing decision. It does not automatically activate all previously deferred cross-depth placement work, manual dragging, the pod model, or a wholesale replacement layout. The existing [deferral list](next-work-plan.md#deferred-work) remains unchanged pending further direction.
