# Node-face editing and map copying

September 28, 2026. **Live in Worker 47**, after all 47 local and 47 hosted release checks and public verification. Follow-up to the completed [node-menu cleanup](node-menu-cleanup-plan.md). The owner approved expanding **Details** on the node itself.

## Accepted behavior

- **Add child node** immediately places an unfinished child on the map beneath its parent, opens its face at a readable size, and focuses its title. The preview belongs to the map layout but is not saved until **Add child node** is submitted. Cancel removes it. A reason relationship, when selected, is committed together with the child.
- **Edit** expands the selected node face. Title, short description, and confidence remain directly available; **Details** expands longer context and sources on that same face. Frame titles remain fixed. **Save changes** keeps editing open; **Done** saves valid edits and returns to the map. Account autosave preserves the active field and caret. **Inspect details** retains read-only wording, definitions, and connection management in the optional inspector.
- All eligible confidence editors use a 0–100 slider and a compact numeric field. The slider uses whole percentages; the number field retains exact decimals. **Not assessed** clears both representations without turning null into zero or an implicit midpoint. Other authors' values and source browsing remain read-only.
- **Copy map** is directly available beside **Open map** on owned Library cards. It opens the existing creation form with a suggested name and source. The earlier **Create map → Start with → Copy…** route remains available for accessible maps. A full copy has independent ownership and is private by default; it preserves frame details, nodes, hierarchy, internal connections, citations, and attribution. Own confidence is retained; another author's confidence is cleared. Conversations, comparisons, co-signs, and invoked definitions are not copied.

## Boundaries and verification

The preview never enters account autosave or downloads. Existing discard checks apply when changing nodes, maps, or modes; declining preserves the child's values and parent. Saving/downloading an unfinished child asks the author to finish or cancel it. Folding, resetting, and returning to the map must remove stale controls correctly.

The radial layout and routing remain in place. The expanded face follows its node at a readable screen size and stays within the canvas at narrow widths. Native form controls support keyboard entry, and scrolling inside the face does not zoom the map. Form elements stay mounted across redraws and autosave.

Browser coverage includes immediate preview and focus, cancellation and submission, autosave/caret preservation, expanded Details, slider/numeric/null behavior, narrow layout, private copy creation, empty maps, source access loss, and reload. Existing account/database, cross-mode, standalone, and build checks remain release gates. [Deployment status](deployment-status.md) records the verified release; the [deferral list](next-work-plan.md#deferred-work) is unchanged.
