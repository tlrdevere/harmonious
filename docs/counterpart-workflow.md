# Counterparts in Compare

The [full-size counterpart and straight-connection follow-up](comparison-space-and-lines.md) updates this workflow and is being verified. Worker 49 is the preceding published baseline; [deployment status](deployment-status.md) records publication.

## Delivered behavior

Once a counterpart is linked, **Request counterpart** is absent from the node actions and counterpart chooser. Frame headings already occupy corresponding frame positions and do not offer requests.

Compare displays **one visible edge per node pair**. Counterpart links, agreement/disagreement judgments and earlier records are grouped behind that edge; opening it exposes their separate saved details. Conflicting judgments use **Mixed judgments**. Likewise, an example's structural parent edge and illustrative relation share one source line, with the underlying meanings accessible in Connection details. Collapsed nodes do not create duplicate visible edges.

Selecting an ordinary node leaves node positions, zoom, camera, folds, and filters unchanged. Ordinary nodes start independently unless a qualifying pair has been deliberately recorded. Matching titles, sibling order, copied IDs, and copy provenance do not position them as counterparts. Each unpaired visible ordinary node has a full-size ghost/status card, equal in width and height to the real node; selection does not create or move it.

An unlinked ghost says **No counterpart linked** and offers **Link counterpart** in Compare when permitted. A saved, active, unanswered **Request counterpart** changes its status to **Counterpart requested**, with **Respond** or **View request** as appropriate. Opening or cancelling the request form sends nothing. Ghosts are comparison display elements, not empty nodes, saved requests, or assessments of the other person's position. Their geometry remains the same across shared modes; authoring controls remain in Compare.

The recipient can open the spot and choose:

- **Create counterpart in my map**: select a parent in their own map and write a title and optional explanation. Saving creates the real node and its counterpart link together.
- **Link counterpart**: explicitly choose an existing ordinary node from the opposite map. The searchable picker identifies its map/owner and parent path, and previews its wording. A different-frame choice is explained. This adds only an attributed comparison link; neither source map is edited.
- From the request, **No position yet** or **Not applicable**: record an explanation. The full-size ghost shows that request state, with its explanation/history in the inspector. The request author can close or reopen the request with an explanation.

**Link counterpart** works from either person's node when the current participant owns at least one endpoint and both nodes are accessible. The chooser begins with no node selected. Creation remains restricted to the participant's own map. Empty lists explain the available next step rather than offering an empty submission.

**View linked counterparts** lists existing opposite nodes with owners and paths; **Link another counterpart** preserves multiple links. Counts group distinct pairs, while saved meanings and authors remain individually inspectable. **View counterpart request** opens the existing request and its current responses instead of creating a duplicate. Declining discard, switching modes, and failed validation preserve unfinished work; confirmed cancellation creates nothing.

**Counterpart** is a neutral, separately saved connection. It does not record agreement or disagreement. Compare's Endorse, Disagree, and No position remain personal stances toward another person's source; they do not create pair assessments. Earlier paired judgments remain readable, with retired authoring controls absent. An author may withdraw their own link, retaining history and both nodes. After the last qualifying pair is withdrawn, each node returns to its independent ghost/status display; an existing request retains its appropriate requested or response state. Another author's remaining active record keeps the pair linked.

## Placement

Only qualifying saved pairs share adjacent positions. Active counterpart links take priority, followed by earlier explicitly recorded Agreement/Disagreement pairs for compatibility. Older comparison records retain their inspected connections/history without newly driving adjacency. One node appears once, even when it has several links. Parent relationships in the original maps remain untouched, including when paired nodes have different source-tree depths.

The radial comparison layout is built from occupied groups of real cards and full-size ghosts. It expands outward to clear straight parent connections, with actual source cards and ghosts treated as obstacles. It does not retain abandoned pair slots. Frame headings keep corresponding positions when visible; their numbers count real children, not ghosts or links. Independent frame filters contribute only visible headings. Expansion, collapse and frame filtering retain zoom and a visible anchor; **Fit** provides an overview on demand.

An adjacent saved pair uses a short straight connection across its gap. Opening or keyboard-activating that connection exposes its recorded meanings and authors; the node's **View linked counterparts** remains available. A wide label does not force a bent bracket above the pair. Nonadjacent or exceptional obstructed connections retain appropriate inspected routes without crossing cards.

Cross-frame counterparts stay in their original frames and are connected across them. The chooser explains this when its selection is in a different frame. Multiple counterpart connections are retained; the first available qualifying pair determines adjacent placement, with every other link accessible. Known links to another frame, a collapsed/filtered branch, or an unavailable endpoint have truthful linked/unavailable status instead of **No counterpart linked**. Hidden descendants never turn the visible ancestor into a counterpart. Only authorized history and source information are shown.

No manual dragging or persisted manual coordinates were added.

## Verification

- Layout coverage includes independent equal-order nodes, saved-pair priority, swapped map sides, equal ghost/real-card dimensions, occupied group ancestry, straight parent corridors, no abandoned slots, unchanged source trees, and non-overlapping cards/controls.
- Two-account browser coverage includes stable selection, explicit ghosts and request states, direct creation under an owned parent, choosing from either map without duplication or source-map edits, no implicit agreement, no-position/reopen flows, saved links, draft protection and narrow screens. The positioning plan specifies the complete follow-up acceptance matrix.
- Account and PostgreSQL tests cover request-author/recipient permissions, linking and withdrawal, creation plus linking in one save, privacy, reload and history. The existing discussion storage supports this without a schema migration.
- The complete release runner covers application/account checks, active browser walkthroughs, portable export, and the production build. [Deployment status](deployment-status.md) records the actual completed run and release, rather than carrying forward an older check count.
