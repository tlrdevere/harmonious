# Cross-frame topic alignment and branch focus

Implemented and published as **Worker 67** on October 9, 2026, after **66/66 local and hosted checks** and live verification. See [deployment status](deployment-status.md) for release identifiers and evidence.

## Cross-frame positioning

Existing saved connections between ordinary nodes directly beneath different frame headings now determine shared radial sectors. An SQ → TA → GS chain occupies a matching angle around the three headings. Distances can differ to make room for branches. Descendants retain their real parents and occupy their topic's sector. Several topics in one frame use neighboring positions within the connected group's sector rather than overlapping cards.

Alignment uses all first-tier topics and complete descendant counts, independent of folds and connection visibility. Existing eligible connections apply after refreshing. Creating, changing or removing a connection in Create recomputes placement while preserving zoom and an initiating node's screen position. With no eligible links, the previous independent layout remains. Deeper connections retain their existing behavior.

Create and ordinary source browsing share this layout. Outer comparison, Inquiry and Argument views use the sector policy for their display groups, with counterpart adjacency and agreement cards taking precedence. Full first-tier topology preserves angular choices when an opposite frame is collapsed or the sides are swapped. Cross-depth counterpart arrangements can prevent alignment in an affected frame; paired placement wins. No node parentage, connection meanings or permissions change.

The canvas grows to accommodate content. Existing card-avoiding routing handles exceptional obstructed connections; arbitrary cross-frame graphs are not guaranteed to be crossing-free or entirely straight. Fit remains an explicit overview action.

## Focus selection

Use **View options → Focus selection** to choose first-tier topics, grouped by map and frame. **Apply focus** keeps those topics, descendants and internal connections prominent. Other nodes and connections fade, including links with an endpoint outside the selection. Frame headings remain readable. The checkbox chooser keeps exactly the branches selected by the user.

Create and outer comparison node menus offer **Focus this branch** for first-tier topics. This shortcut selects the connected topic group across frames in that map, following saved first-tier cross-frame connections in either direction, including chains and one-to-many links. All selected topics' descendants are emphasized. Same-frame links, deeper endpoints and counterparts belonging to another map do not extend this set. **Change selection** can then adjust it explicitly.

**Clear focus** is visible at the top-right of the canvas whenever focus is active, including after a reload, and remains in View options as well. Clearing preserves layout and zoom and returns keyboard focus to the canvas. View options shows the number of focused branches while closed. Cancel and Escape discard chooser changes. Keyboard focus temporarily restores faded content's contrast for inspection. See deployment status for the cross-frame shortcut and visible reset follow-up's publication.

Focusing preserves positions, zoom, folds, assessments and map content. New descendants inherit their branch's treatment. Ghosts follow their source branch. A shared agreement display remains identifiable when either half is focused, while each counterpart half follows its own explicit selection.

Session storage retains selections per map or map pair and viewing context within the same browser tab. They are not synchronized to other devices or included in exported map content. Missing or inaccessible topics are removed from the selection. Focusing still works when browser storage is unavailable.

The inner Argument dialogue canvas retains its reply layout and controls. The technology stack and previous deferrals are unchanged. No database migration is needed.

## Verification

Model checks cover three-frame chains, one-to-many links, crowded and unequal branches, stable expansion, removed links, deeper connections, swapped maps, collapsed counterparts, card/ghost clearance and immutable data. Browser checks cover Create and outer comparison/Argument selection, descendants, ghosts, connections, joined agreement halves, reload, folds, unchanged geometry and narrow-screen controls. Release verification includes the full local and hosted suites, reviewed desktop/narrow captures, and exact live asset/access checks.
