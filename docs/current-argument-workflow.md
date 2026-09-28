# Working in a shared Comparison

Updated September 28, 2026. The [node-face editing, confidence scale, and map-copy follow-up](node-face-editing.md) is **live in Worker 47**, after all 47 local and 47 hosted checks and public verification. It builds on the verified picker, frame palette, and node-menu cleanup. [Deployment status](deployment-status.md) records publication and public verification. Compare, Inquiry, and Argument use the same saved comparison, source maps, and camera; [the grammar](interaction-grammar-v4.md) defines the actions.

## Start or reopen a comparison

From Library → Comparisons, choose **Choose maps**. Select the first and second source using the two visible map selectors, then select **Start / open comparison**. Each choice identifies the map and its owner. The selectors remain available when View options closes; View options contains display settings. An existing pair opens its saved comparison. **Compare with my map** preselects the other person's map while leaving your source for you to choose.

Once the pair is open, its names and owners remain in the heading. **Change maps** returns to the same selectors and respects unfinished forms. Selecting a map does not change sharing. Empty or unavailable choices explain why a pair cannot start.

## Choose a mode

| Mode | Use it to |
| --- | --- |
| Map / Create | Edit your own nodes, add a child with an optional reason relationship, inspect details, and connect existing nodes. |
| Inquiry | Request reason, Request explanation, Propose alternative, or Offer reason. |
| Compare | Record Endorse, Disagree, or No position toward another person's node or connection. Find, link, or request a counterpart. |
| Argument | Dispute reasoning, choosing the grounds relevant to a node's frame or a connection's type. |

Select a source node or connection to see its available actions. The three frame headings are containers. A cited node offers additional source-related dispute grounds. Other opens free text; comments and a single node reference are optional. A dispute needs at least one ground. Internal Signals tags are never shown.

In Map/Create, selecting a node opens its on-map menu. **Edit** occupies a separate section; **Add child node** and **Inspect details** are the main actions. **More actions** expands to reveal **Delete branch** and changes to **Fewer actions**. Close returns focus to the node. **Edit** expands the node face with its title, short description, and confidence directly available. **Details** expands longer context and sources on the same face. **Save changes** keeps editing open; **Done** saves valid changes and returns to the map. The optional inspector remains for reading, **Definitions & standards**, and **Connections**. Owners reach **Connect existing node** from Connections. Generic Compare navigation is absent from this menu.

**Add child node**, including the node's plus control, immediately shows an unfinished child in the map layout and places the cursor in its title on the expanded face. Wording, sources, and confidence remain a draft until the final **Add child node** submission. **Relationship to parent** defaults to **Organization only**; **This child is a reason for its parent** also creates the explicit child → parent reason connection in that submission. Cancel removes the preview and creates no records. Leaving or switching maps checks before discarding an unfinished child, and declining keeps its values and parent. Autosave never submits a child draft. **Save now** and **Download backup** ask you to finish or cancel it, preserving its contents. Existing-node edits retain autosave without replacing the active field or moving the caret. The expanded face stays readable at different map zooms; scrolling its contents does not zoom the map.

The three frame containers offer **Edit frame details**, child creation, and applicable inspection. Their fixed titles do not change, and they have no confidence, reason-to-parent choice, semantic connection creation, or Delete branch. Ordinary nodes directly beneath a frame use the same actions as deeper nodes. Frame identity uses the same lightish red for Status Quo, blue for Transformative Action, and green for Goal State in Map/Create and shared/source views, alongside visible frame names. Owner identity remains separate.

Node footers omit redundant type and author labels in Map/Create. Confidence and expansion/add controls remain available, and signed-in edits use the global autosave indicator.

Selecting a connection in Map/Create opens its on-map detail with its actual endpoints, direction and saved meanings. Additional connections have Edit/Remove actions for their owner; a parent–child branch describes organization rather than asserting a reason. Removing an additional connection does not remove that branch. View options controls additional connection visibility, with All visible as the default.

## Read and find interactions

Source badges count initiating conversations, excluding their responses. A badge opens exactly that category of conversations. Collapsing a branch keeps its attachments reachable from the visible ancestor. Select Conversations to browse the current mode; Withdrawn interactions opens historical threads.

Rows identify the action, author, source, and a compact preview of the selected choices or comment. Response rows show the outcome, such as Partly accept, rather than a generic Respond label. Open a row for full wording and options; withdrawn responses remain labeled within their parent thread.

Find is available in all three modes and searches only the current comparison and mode. It includes selected choices, Other text, comments, authors, source labels, accessible references, and response outcomes. Each mode remembers its query during the page session. Argument offers All and Disputes; no filter claims that a response resolved a dispute.

Show on map reveals the original source and opens the same detail as an attachment or conversation row. It preserves zoom and unrelated branch folds. A response result opens its parent thread with the matching response identified; select that response to inspect its full details and any available reviewed map change. Source positions do not change merely because the mode changes.

## Respond and optionally change your map

Only the intended recipient can Respond to an active request, proposal, offer, or dispute, within its originating mode. Choose one outcome. Compare stances do not acquire a generic response control.

Recording a stance or accepting an interaction does not edit either map. A separate Review action previews an owned copy, revision, or added reason; Apply to my map commits that change. Copies retain independent authorship. Responses do not automatically close or resolve disputes.

Unfinished forms are parked when you switch modes and restored when you return. Opening another target uses the existing discard safeguard. Reload after All changes saved to check persistence on another PC.

## Meaning, confidence, and counterparts

The [comparison clarity increment](comparison-clarity-plan.md) is being implemented and verified. It makes ordinary selection preserve node positions and the camera, while saved unanswered requests retain explicit requested-counterpart spots. **Link counterpart** opens the opposite map's searchable chooser from either participant's node, with no preselected match. **View linked counterparts** shows existing pairs and their authors; **Link another counterpart** preserves multiple links. **Create counterpart in my map** changes only the current participant's map. [The counterpart workflow](counterpart-workflow.md) describes request states, withdrawal, and placement. Publication is tracked in [deployment status](deployment-status.md).

Source-map organization uses solid neutral lines; saved directed connections add arrowheads, retaining one route per actual pair. Counterpart links keep their distinct style and do not assert agreement. Decorative SQ-to-TA/TA-to-GS lines are omitted from the shared canvas. **View options → Connection key** explains the conventions. Hovering, focusing, or selecting a source connection identifies its actual endpoints. Routes avoid cards and prefer separate sibling paths without changing radial node positions; dense maps may still contain crossings.

Definitions and standards are maintained centrally in Map Library and invoked at relevant sources. In Map/Create they appear in **Inspect details → Definitions & standards**; shared source inspection retains its Meaning section and permitted read/edit controls.

Eligible ordinary nodes show **Confidence —** when unassessed or **Confidence n%** when assessed. Null remains different from **0%**. Owners can set a score during creation, in Edit, or from the node's confidence value. Each confidence editor offers a 0–100 slider beside a compact number field. The slider adjusts whole percentages; the number field retains exact decimals. **Not assessed** clears the rating, and opening an empty scale does not assign a midpoint. Direct editing does not force open the inspector; saving or backing out returns focus to the value. Other authors' scores are read-only, and source-map browsing is read-only even for an owned map. Shared modes retain a separate **Edit in my map** route without a duplicate confidence menu action. Frame containers and older Topic/Question/Explainer records have no confidence control. An independent copy does not inherit another author's confidence, and assessing confidence does not assert agreement.

Counterpart links identify comparable nodes separately from stances. Request counterpart is available in Compare for your own unlinked ordinary node without an existing request. Either participant can link existing nodes; the recipient can also create a counterpart in their own map. Only saved unanswered requests keep a requested spot visible; a linked node does not offer another counterpart request.

When an earlier relationship or counterpart connection leads inside a collapsed branch, that branch has a compact **↔** count instead of a line to a substitute ancestor. Open it for the actual node pairs, including names and parent paths. The count represents distinct pairs, not people agreeing or individual judgments. **Show connected nodes** opens the necessary branches on both maps while retaining zoom, unrelated folds and saved history. A requested reveal can clear a frame filter; unavailable sources retain permitted history without a fabricated endpoint.

## Copy a map or selected content

On an owned Library card, **Copy map** sits beside **Open map**. It opens the map-creation form with the source selected and a suggested copy name. **Create map → Start with → Copy…** remains available for accessible maps. Confirming creates a separate owned map, private by default, with its frame details, nodes, hierarchy, internal connections, citations, and source attribution. Copying your own map preserves your confidence values; copying another author's map leaves the new values unassessed. Editing the copy does not change the original. Conversations, comparisons, co-signs, and invoked definitions are not duplicated.

Source browsing also retains its existing copy-and-adapt controls for adding selected content to a different map you already own. That route asks for a destination and copies only the selected nodes and their internal connections; it does not create a whole new map or record an endorsement.

## Earlier records

Earlier relationships, reasons, challenges, replies, and annotations remain readable with their attributed history. Their old creation, editing, adoption, reflection, and Resolve/Reopen controls are retired. Authorized withdrawal remains available. Counterpart fulfillment and central definitions remain supported workflows.

Earlier records and Earlier reasoning preserve the previous proposal-based material as read-only views. Their historical data model remains supported; opening an old record does not silently convert it into a new interaction.

## Positioning

The source maps still use radial positioning. Sparse branches with one or two children can look vertical. Counterpart alignment can move a node away from its source branch; [the placement study](design/counterpart-depth-study.html) shows a representative cross-depth case. Manual dragging and a replacement layout remain deferred.

Connection drawing now uses one policy: direct boundary-to-boundary lines where clear, small rounded detours around cards where needed. Ring arcs no longer denote a separate branch convention. One visible edge represents each actual pair, with additional meanings available in detail. Source routes stay stable when changing shared modes or panning/zooming. If no clear route exists, the record remains accessible through its existing list rather than drawing through a card.
