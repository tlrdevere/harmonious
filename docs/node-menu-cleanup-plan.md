# Map selection, frame colors, and node menus

September 28, 2026. **Status: implemented and published as Worker 46; all 46 local and 46 hosted checks passed.** The owner accepted this plan and instructed execution in the existing checkout on `redesign/node-interactions`. Application commit `626ad697731b2c88da2188a5027160a6b500d3e0` is pushed, deployed, and publicly verified. [Deployment status](deployment-status.md) records the release identifiers and evidence.

## Intended result

Starting a comparison presents two working map selectors. Frame colors consistently identify Status Quo in lightish red, Transformative Action in lightish blue, and Goal State in lightish green. Node actions distinguish editing, adding a child, inspecting details, and deleting a branch. Confidence has a permanent, author-attributed place on eligible nodes, including when it is unassessed.

Use this document as the small menu specification. Continue gathering feedback in ordinary prose and revise the plan when needed; a separate spreadsheet is unnecessary.

## Agreed arrangement

| Location | Contents and behavior |
| --- | --- |
| Map/Create selected-node menu: editing section | **Edit**, visually separated from the other actions. Opens the existing optional editing panel. |
| Map/Create selected-node menu: main actions | **Add child node** opens its form directly. **Inspect details** opens reading and inspection controls. |
| Map/Create selected-node menu: disclosure | A subdued **More actions** / **Fewer actions** control with a chevron and expanded state. **Delete branch** appears inside, visually marked as destructive, with the existing confirmation. |
| Node footer | **Confidence —** for unassessed, or **Confidence n%**. An eligible owner can click the value to edit. Other authors' values are read-only. |
| Child creation form | Wording, sources, optional confidence, and **Relationship to parent**: **Organization only** by default, or **This child is a reason for its parent**. One final **Add child node** action. |
| Node inspector | Wording and sources, **Definitions & standards**, and **Connections** as distinct sections. Eligible owners reach **Connect existing node** from Connections. |

Remove **My confidence**, **Create reason**, **Connect**, **Definitions & standards**, and **Compare** as peer actions in the Map/Create quick menu. Their retained functions move to the locations above. The separate Create reason shortcut is replaced by the relationship choice in the child form, including duplicate controls in the optional editor.

The only special top-level nodes are the three frame containers. They offer **Add child node**, **Edit frame details**, and inspection of applicable details. Keep their fixed names and existing editable details; they have no confidence, semantic connection creation, reason-to-parent choice, or Delete branch. An ordinary node immediately beneath a frame uses the same menu as deeper ordinary nodes.

## Implementation sequence

### 1. Repair new-comparison map selection

**Current cause:** the source identity areas in `dist/library-ui.mjs` are passive spans. The actual selectors and Start button live inside the dismissible View options menu assembled by `dist/discussion-ui.mjs`. Clicking an identity area closes that menu without selecting anything. Edge can initially open the menu when the first selector receives focus, so the failure is not simply that selectors are always hidden.

- Present two genuine, labeled selectors and **Start / open comparison** directly in the new-comparison setup. Keep map/person identification readable in each choice.
- Keep display settings in View options. Essential setup must remain visible when that menu closes, with no dependency on focus automatically expanding it.
- Preserve preselection from **Compare with my map**, explicitly require any missing choice, and use the current validation and create/open logic. Reopening an existing pair must not create a duplicate comparison.
- Explain empty or unavailable choices and retain the existing map-access and shared-comparison eligibility rules. Selecting a map must not change its sharing settings.
- Once a pair is open, show its names and owners clearly. Provide an explicit **Change maps** route to the same selectors rather than styling passive identity labels as buttons. Changing a pair must respect unfinished forms.

Primary files: `dist/library-ui.mjs`, `dist/discussion-ui.mjs`, `dist/workspace-ui.mjs`, `dist/index.html`, `dist/library.css`.

**Acceptance:** from Library → Comparisons → Choose maps, select both maps and open the comparison using visible controls at desktop and narrow widths. Verify preselection, existing-pair reopening, empty choices, owner names, keyboard operation, and reload.

### 2. Apply one frame palette across views

Use the accepted sketch's starting colors:

| Frame | Base color |
| --- | --- |
| Status Quo (SQ) | Lightish red: `#EDAAA7` |
| Transformative Action (TA) | Lightish blue: `#A4C7EB` |
| Goal State (GS) | Lightish green: `#A9CFA8` |

- Centralize the palette instead of maintaining independent arrays in the editor and comparison renderer. Apply it to frame headings, ordinary-node frame accents, and corresponding legend/filter markers in Map/Create, source browsing, Inquiry, Compare, and Argument.
- Preserve the current card structure and frame order (`status`, `action`, `goal`). Maintain readable text and visible selection/focus against each color; use supporting contrast colors only where necessary.
- Reserve lighter category shades for the owner's future feature. Do not assign them new meaning in this change.
- Keep map-owner identity styling separate from frame identity. Pair color with frame labels so interpretation does not depend on color alone.

Primary files: `dist/app.mjs`, `dist/compare-canvas.mjs`, `dist/style.css`, `dist/index.html`, and relevant shared-view styles. Register any new shared module in `scripts/client-assets.mjs` and `scripts/export-standalone.py`.

**Acceptance:** the same frame has the same color in every covered view; ownership remains distinguishable. Inspect representative desktop and narrow layouts, including selected nodes and confidence controls.

### 3. Simplify the menu and make child creation a real draft

- Replace the flat wrapping button list in `dist/node-actions.mjs` with the sections above. Give Close and the disclosure a quieter treatment; retain accessible names, keyboard operation, Escape, and focus return.
- Route both **Add child node** and the node's existing plus control directly to the same form. Remove the intermediate Create node/Create reason choice screen.
- Keep the selected parent named and fixed while composing. Default confidence to unassessed and the relationship to Organization only. Suppress the reason choice when the parent is a frame container.
- Stage the child locally until submission. The current `addChild()` inserts a placeholder into the saved graph before editing; replace that behavior for this flow. Cancel must add neither a node nor a connection.
- On submission, validate the full candidate graph, then add the completed child and optional reason connection in one application state update. A reason points **child → parent**. Ordinary nesting does not assert support.
- Include the new draft in existing dirty-state, navigation, map-switch, panel-close, and autosave safeguards. Cancellation of a discard prompt must retain the draft and its parent. Preserve entered values on validation/save errors and prevent duplicate submission.
- Explicitly exclude pending child creation from the account editor's automatic draft flush. Its current debounce can submit valid edit fields after 1.1 seconds; typing a title must not create the child. `getMapData()` and workspace capture must expose committed content only. Include pending children in `hasDraft`, leave/discard, and map-reset handling.
- Keep ordinary existing-node autosave behavior. While a new child is pending, manual **Save now** or workspace download should direct the person to finish or cancel that child form, preserving its contents instead of silently creating it. Identify the state as a child-node draft rather than claiming that all changes are saved.
- After success, reveal/select the new child using the existing layout and camera behavior. Preserve the branch-deletion confirmation, cleanup of stale controls, and focus return to the surviving parent.

Primary files: `dist/node-actions.mjs`, `dist/app.mjs`, `dist/account-ui.mjs`, `dist/workspace-ui.mjs`, `dist/index.html`, `dist/style.css`, `dist/library.css`; reuse `dist/model.mjs` creation and validation helpers and the current workspace save adapter.

**Acceptance:** one activation opens the child form. Cancel leaves the graph unchanged. Saving ordinary and reason children produces exactly the requested records, direction, confidence, and wording, including after reload. Frame containers and ordinary nodes at different depths follow their specified rules.

### 4. Separate inspection and make confidence consistently accessible

- Reuse the optional inspector with explicit reading/editing states. **Inspect details** should not open an edit draft or silently discard one. **Edit** opens the appropriate wording/source/confidence fields directly.
- Put definitions and standards in their own inspection section, using the existing central library and exact invoked references. Preserve their existing permitted read/edit behavior.
- Put existing relationships and **Connect existing node** in Connections. Retain the current typed connection form, direction and endpoint validation, existing connection inspection/edit/removal, and single-route-per-pair drawing.
- Keep `reason`, `cause`, `addresses` (SQ → TA), and `enables` (TA → GS) semantics. This is a placement and wording change, not an expansion of supported relationships.
- Change `confidenceBadge()` in `dist/confidence-ui.mjs` to render the empty slot for eligible ordinary nodes. Use **—**, with the accessible description **Confidence: not assessed**. Keep null distinct from 0%, and retain the existing 0–100 validation.
- Use **Confidence** throughout the active forms, including shared-view headings and accessible labels. Owners can set it during creation, while editing, or from the node value; clearing it restores the empty slot. Saving from the node must not force open the editor panel. Close returns focus to the originating control.
- Remove duplicate confidence actions from shared source menus after their direct node control works. Preserve ownership enforcement, imported-copy attribution rules, and current legacy-node eligibility: old Topic/Question/Explainer records remain readable and gain no unsupported confidence editor. Explicitly exclude frame containers rather than relying only on their current stored kind.
- Fit the persistent slot into the existing card dimensions and controls. Do not introduce overlap with branch expansion, add controls, conversation badges, or author labels.

Primary files: `dist/confidence-ui.mjs`, `dist/app.mjs`, `dist/compare-canvas.mjs`, `dist/interaction-ui.mjs`, `dist/discussion-ui.mjs`, and the existing definitions integration.

### 5. Verify consistency and prepare the release

Keep the same placement and vocabulary wherever the action is applicable, with these deliberate mode differences:

| View | Authoring and interaction rules |
| --- | --- |
| Map/Create | Owners edit, add children, connect existing nodes, set confidence, and delete branches. |
| Source-map browsing | Read-only source details, definitions, connections, and confidence; retain the explicit route to edit an owned map. |
| Inquiry | Other people's ordinary nodes/connections offer Request reason, Request explanation, Propose alternative, and Offer reason. |
| Compare | Other people's ordinary nodes/connections offer Endorse, Disagree, and No position. Retain appropriate counterpart controls. |
| Argument | Other people's eligible nodes/connections offer Dispute reasoning. |
| Own node in a shared mode | Direct confidence editing and a separate **Edit in my map** route; retain applicable counterpart controls. Do not duplicate the full map-authoring menu here. |

Exercise existing draft preservation, mode switching, owner permissions, source reading, and connection geometry while checking the new placements. Do not put generic Compare navigation back into Map/Create.

## Verification and completion criteria

Extend active suites rather than relying on the retired navigation browser test. The current passing 46 checks did not cover clicking the apparent Choose a map labels.

- **`map-grammar-browser`:** menu groups, direct child entry from both controls, cancel without records, reason direction, confidence at creation, root/depth behavior, draft guards, branch deletion, and focus return.
- **`confidence-browser`:** replace old assertions that null hides the badge and that My confidence is a menu action. Cover null, 0%, 100%, decimals, clearing, invalid values, creation/edit/direct access, persistence, ownership, and narrow layout.
- **`mode-consistency-browser`:** add the actual new-comparison entry path and its source-label regression; check shared/source view placement, definitions and connection reachability, confidence ownership, distinct mode actions, and preserved drafts.
- **`account-autosave`:** wait beyond the normal debounce after entering a valid child title and verify no child or reason has been captured or submitted. Cover cancel, explicit creation, manual Save now/download handling, retry without duplication, and continued autosave for existing-node edits. Update active interaction-browser selectors where shared menu wording changes.
- Add focused model/account assertions only where the draft-first creation change affects saved state. Reuse existing graph, relation, and confidence validation coverage.
- Inspect representative desktop and narrow screenshots and check keyboard/touch access. The sketch is a design reference, not a substitute for testing the application.
- Run the complete existing release verification after the application changes stabilize, including account/database regressions, standalone export, production build, and asset completeness. Record actual results; do not assume the count stays 46 if coverage is reorganized.

Update [the current workflow](current-argument-workflow.md), [v4 grammar](interaction-grammar-v4.md), and [user-testing checklist](user-testing-checklist.md) when implemented. Record implementation and release status separately in [the next-work plan](next-work-plan.md) and [deployment status](deployment-status.md).

The release followed the established sequence: commit the completed application changes on `redesign/node-interactions`, push, run the manual hosted checks on that exact revision, deploy that verified application, and verify public assets and account gates. Automatic deployment remains disabled.

The work is complete when the picker works from the real entry path, the palette and applicable controls agree across views, new child drafts do not leak saved placeholders, the verification passes, and the released behavior is accurately documented for the owner's walkthrough.

## Implementation evidence

- Full local run: **46/46 passed**; `build/verification/2026-09-28T20-12-45-780Z-88264/summary.json`, using Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows.
- Hosted run: **46/46 passed** on the exact application commit in [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/36477959624). Worker 46 was deployed at **20:19:49 UTC** and public verification passed at **20:20:49 UTC**, matching all 53 client files and the homepage and preserving the account gates and eight encrypted bindings.
- Extended active browser cases cover the real map-picker entry path, setup reopening, empty/unavailable sources, owner names, direct child drafts, absence of background saves, explicit reason creation, inspection/edit separation, persistent confidence, ownership, and keyboard focus. Account autosave checks guard the delayed-flush boundary.
- Independent review caught and corrected child-discard panel restoration, immediate confidence input focus, disclosure focus, and portable Reset draft cleanup. The initial full run also caught a palette initializer incompatibility with minimal test DOMs; the final run above includes its correction.
- Desktop and narrow screenshots of setup, menus, inspector, confidence and source/shared frame colors were inspected. A separate portable browser check confirmed Reset followed by Save downloads committed data without the cancelled child.

## Scope boundaries

No database migration is expected: nullable confidence and the retained relationship types already exist. Preserve saved maps, authorship, invoked definitions, historical records, source access rules, and current frame names. Reuse the current layout and connection routing.

The [deferral list](next-work-plan.md#deferred-work) remains unchanged. This plan does not activate Compass, cross-depth placement redesign, return-visit catch-up, onboarding/worked examples, change-context discoverability work, arbitrary reasoning links, or other deferred features. A spreadsheet, new menu framework, and dependency upgrades are not needed for this cleanup.
