# Missing counterparts in Compare

## Delivered behavior

Once a counterpart is linked, **Request counterpart** is absent from the node actions and counterpart chooser. Frame headings already occupy corresponding frame positions and do not offer requests.

Compare displays **one visible edge per node pair**. Counterpart links, agreement/disagreement judgments and earlier records are grouped behind that edge; opening it exposes their separate saved details. Conflicting judgments use **Mixed judgments**. Likewise, an example's structural parent edge and illustrative relation share one source line, with the underlying meanings accessible in Connection details. Collapsed nodes do not create duplicate visible edges.

Selecting an ordinary node with no saved counterpart displays a dashed **No counterpart linked** spot on the other map's side. An open **Request counterpart** keeps that spot visible for both participants even when the source is not selected. The placeholder is a comparison display element, not an empty node in either person's map.

The recipient can open the spot and choose:

- **Create counterpart**: select a parent in their own map, choose a node type, and write a title and optional explanation. Saving creates the real node and its counterpart link together.
- **Choose existing node**: choose an existing ordinary node from their own map. The picker includes its parent path and a wording preview. This adds only the link.
- From the request, **No position yet** or **Not applicable**: record an explanation. The large spot collapses to a small source status indicator. The request author can close or reopen the request with an explanation.

The map author can reach the same flow through **Find or view counterpart** on a selected node. Existing requests reopen instead of creating duplicate requests through that button. Existing content, source snapshots, definition invocations and contribution authorship remain intact.

**Counterparts** is a neutral, separately saved connection. It does not record agreement or disagreement. Opening that connection offers those judgments as separate actions. An author may withdraw their link, retaining history. If an unanswered request still exists, withdrawing the last available counterpart link brings back its empty spot.

## Placement

Saved counterpart links take priority over provisional sibling-order slots. In the same frame, the two nodes share a display row with a fixed gap. An unrelated node occupying the destination is placed in another display slot; it is neither merged nor deleted. Parent relationships in the original maps are untouched, including when the paired nodes have different source-tree depths.

The initial placement still uses branch order where nobody has linked counterparts. Frame headings keep their shared frame positions. Hidden descendants do not turn their visible ancestor into an asserted counterpart; expand the branch or use **Show linked counterpart** to reveal the actual node.

Cross-frame counterparts stay in their original frames and are connected across them. The chooser explains this when its selection is in a different frame. Multiple counterpart connections are retained; the first available explicit, non-conflicting pair determines adjacent placement, with other connections still drawn. Earlier agreement/disagreement records also identify compared pairs, but explicit counterpart links take layout priority.

No manual dragging or persisted manual coordinates were added.

## Verification

- Layout checks cover swapped map sides, displaced unrelated neighbors, multiple empty spots, unchanged source trees and non-overlapping cards/placeholders.
- Two-account browser checks cover request persistence, direct creation under an owned parent, choosing an existing node without duplication, no implicit agreement, no-position/reopen flows, saved links, draft protection and narrow screens.
- Account and PostgreSQL tests cover request-author/recipient permissions, linking and withdrawal, creation plus linking in one save, privacy, reload and history. The existing discussion storage supports this without a schema migration.
- The full application/account suite, all three browser walkthroughs, portable export and production build checks pass.
