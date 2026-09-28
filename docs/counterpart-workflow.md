# Counterparts in Compare

The [comparison clarity increment](comparison-clarity-plan.md) is **live in Worker 48**, after all 48 local and 48 hosted checks and public verification. It delivers the behavior below. [Deployment status](deployment-status.md) records the exact source and publication evidence.

## Delivered behavior

Once a counterpart is linked, **Request counterpart** is absent from the node actions and counterpart chooser. Frame headings already occupy corresponding frame positions and do not offer requests.

Compare displays **one visible edge per node pair**. Counterpart links, agreement/disagreement judgments and earlier records are grouped behind that edge; opening it exposes their separate saved details. Conflicting judgments use **Mixed judgments**. Likewise, an example's structural parent edge and illustrative relation share one source line, with the underlying meanings accessible in Connection details. Collapsed nodes do not create duplicate visible edges.

Selecting an ordinary node leaves node positions, zoom, camera, folds, and filters unchanged. **No counterpart linked** is an inspection status; selection alone does not create an empty counterpart spot or move an opposite node. Initial adjacent positions follow sibling order and do not establish saved counterparts.

Only a saved, active, unanswered **Request counterpart** reserves a **Counterpart requested** spot. Opening or cancelling the request form reserves nothing. The spot remains visible for both participants across ordinary selection and mode changes. It is a comparison display element, not an empty node in either person's map.

The recipient can open the spot and choose:

- **Create counterpart in my map**: select a parent in their own map and write a title and optional explanation. Saving creates the real node and its counterpart link together.
- **Link counterpart**: explicitly choose an existing ordinary node from the opposite map. The searchable picker identifies its map/owner and parent path, and previews its wording. A different-frame choice is explained. This adds only an attributed comparison link; neither source map is edited.
- From the request, **No position yet** or **Not applicable**: record an explanation. The large spot collapses to a small source status indicator. The request author can close or reopen the request with an explanation.

**Link counterpart** works from either person's node when the current participant owns at least one endpoint and both nodes are accessible. The chooser begins with no node selected. Creation remains restricted to the participant's own map. Empty lists explain the available next step rather than offering an empty submission.

**View linked counterparts** lists existing opposite nodes with owners and paths; **Link another counterpart** preserves multiple links. Counts group distinct pairs, while saved meanings and authors remain individually inspectable. **View counterpart request** opens the existing request and its current responses instead of creating a duplicate. Declining discard, switching modes, and failed validation preserve unfinished work; confirmed cancellation creates nothing.

**Counterpart** is a neutral, separately saved connection. It does not record agreement or disagreement. Compare's Endorse, Disagree, and No position remain personal stances toward another person's source; they do not create pair assessments. Earlier paired judgments remain readable, with retired authoring controls absent. An author may withdraw their own link, retaining history and both nodes. If an unanswered request still exists and its source remains available, withdrawing the last applicable counterpart link brings back its requested spot.

## Placement

Saved counterpart links take priority over provisional sibling-order slots. In the same frame, the two nodes share a display row with a fixed gap. An unrelated node occupying the destination is placed in another display slot; it is neither merged nor deleted. Parent relationships in the original maps are untouched, including when the paired nodes have different source-tree depths.

The initial placement still uses branch order where nobody has linked counterparts. Frame headings keep their shared frame positions; their numbers count children, not links. Hidden descendants do not turn their visible ancestor into an asserted counterpart; expand the branch or reveal a linked counterpart to reach the actual node. A deliberate Fit or reveal action remains available; ordinary selection does not fit the camera automatically.

Cross-frame counterparts stay in their original frames and are connected across them. The chooser explains this when its selection is in a different frame. Multiple counterpart connections are retained; the first available explicit, non-conflicting pair determines adjacent placement, with other connections still drawn. Earlier agreement/disagreement records also identify compared pairs, but explicit counterpart links take layout priority.

No manual dragging or persisted manual coordinates were added.

## Verification

- Layout checks cover swapped map sides, displaced unrelated neighbors, multiple empty spots, unchanged source trees and non-overlapping cards/placeholders.
- Two-account browser coverage includes stable selection, request persistence, direct creation under an owned parent, choosing from either map without duplication or source-map edits, no implicit agreement, no-position/reopen flows, saved links, draft protection and narrow screens.
- Account and PostgreSQL tests cover request-author/recipient permissions, linking and withdrawal, creation plus linking in one save, privacy, reload and history. The existing discussion storage supports this without a schema migration.
- The complete release runner covers application/account checks, active browser walkthroughs, portable export, and the production build. [Deployment status](deployment-status.md) records the actual completed run and release, rather than carrying forward an older check count.
