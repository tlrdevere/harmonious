# Status Quo timeline and node insertion implementation plan

November 18, 2026. The experimental branch is `feature/status-quo-subframes`, based on `redesign/node-interactions`.

## Try the prototype

Run `python scripts/export-standalone.py` and open `review/Harmonious-timeline.html` in a browser. The local sample opens Alex’s **Getting home by bus** map. Select **Status Quo timeline** and expand History or Likely Future. Select **Outline** to read the claims with their original parents. Under **Comparisons**, open the saved bus comparison to see a timeline where just one participant has added historical and future claims.

To try insertion, select **Evening buses run hourly**, choose **Insert node above**, and enter a title. The editor shows the proposed parent and child before saving. **Save workspace file** downloads a copy of any edits made in the sample.

For an account-backed rollout, apply `supabase/migrations/20261119005635_structural_edge_identity.sql` before publishing the branch’s Worker. The standalone preview works independently of the beta database.

## Status Quo timeline

### Two horizontal views

Put a visible two-option switch near the Canvas / Outline control. It applies to the whole view, including both maps in a comparison. Main frames is the default.

| View | Left | Center | Right |
| --- | --- | --- | --- |
| **Main frames** | Status Quo | Transformative Action | Goal State |
| **Status Quo timeline** | History | Status Quo · Present | Likely Future |

Each Canvas view shows exactly those three sections. The corresponding Outline sections follow the same order from top to bottom. Keep all three headings readable in the timeline, including when a section is empty. Ordinary branch expansion happens within the selected view.

History explains how present conditions came to be. Likely Future describes what the author expects without the proposed Transformative Action. Authors can use the existing **Cause** and **Reason** connections to explain how individual claims relate. The left-to-right arrangement communicates time. A connection communicates the author's stated relationship. The [Harmonious framework](framework.md#the-three-active-frames) defines these distinctions.

### Build sequence

1. **Prototype the layout.** Start `feature/status-quo-subframes` from the existing branch and use representative fixture maps for the preview. Adapt the layout to three display sections per view while retaining the three saved frame roots. Treat the History and Likely Future headings as containers in the presentation. Fit large branches within their own sections, retain the zoom, and keep the active node in view when it belongs to both views.
2. **Connect the existing time perspective field to authoring.** Show Present, History and Likely Future when creating or editing Status Quo nodes. Default new children to their parent's time perspective and treat an absent value on an older node as Present. Save classification through the existing map workflow. Retain explicit classifications, including on older maps. When a parent sits in a different period, display the node in its chosen section with its real parent in the breadcrumb. Preserve node IDs, real hierarchy, and connection endpoints when a node changes period. Check copies and imports for the same behavior.
3. **Share the visibility and navigation rules.** Use one projection rule across Create, shared source browsing, Comparison, Inquiry and the outer Argument view. Render connections when both endpoints are visible. Offer to open the destination view when a connection panel points to a hidden endpoint. Existing saved counterpart pairs still count as linked when one endpoint is hidden. Search, saved links and Activity can reveal a hidden target by switching views after the existing leave guard. A target in Present can open in either view. Going between Canvas and Outline retains the view choice and the draft or selection the current interface supports.
4. **Review the preview before a beta rollout.** Try a dense three-section timeline, a branch whose parent and child sit in different periods, and a comparison where only one participant has History or Likely Future nodes. Check for card and line collisions, clear section boundaries, accurate counterpart state and usable zoom and focus. Verify that repeated switching keeps the frame sets exclusive, preserves edits and collapse state, and exposes only sources the account can already access. Run the existing verification suite and add focused coverage for the new behavior.

The initial preview ends at the two-view switch. For a later Likely Future / Goal State overlay, explore explicit claim reuse so the same wording can appear once with both **Expected** and **Desired** labels. Distinct claims can appear side by side. That design should account for separately edited wording and version history before choosing how shared claims are saved.

## Insert a node between a parent and child

1. **Add Insert node above to the child's menu** in Canvas and Outline for map owners. Reuse the node creation editor, show `Parent → New node → Child` in the draft, and focus the title. Allow insertion directly below a frame or deeper in a branch. Cancel restores the original branch and selection.
2. **Save the insertion as one revision-checked map edit.** Put the new node in the child's former sibling slot and move the child and its subtree below it. Keep the existing child ID, descendants, explicit Reason and Cause connections, and node attachments. Validate relationships on both sides of the new node. For an older typed relationship such as **Answers parent question**, require a valid choice before saving. Keep the draft available if a newer edit conflicts. If the timeline is present, the inserted Status Quo node starts with the child's time perspective.
3. **Protect saved connection history.** The current structural connection ID derives from the child ID. Give the replacement connections distinct identities, keep legacy IDs for untouched links, and preserve the original connection's saved conversation and endpoint context in history. Use the same identity rules in Canvas, Outline, and server validation. A stale link should lead to the original authorized history or an unavailable message. Review facilitator approval separately because an insertion changes two nodes in one edit. See the [graph model](../dist/model.mjs) and [facilitation validation](../dist/facilitation.mjs).
4. **Verify the full edit cycle.** Test insertion and cancellation in both presentations, sibling order, collapse and reload, a concurrent edit, older typed links, and historical conversations about the replaced connection. Test a first-tier topic with an explicit cross-frame link. Its connection keeps the same endpoints even if the new parent changes automatic topic alignment or branch focus.
