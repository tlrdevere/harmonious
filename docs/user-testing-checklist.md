# Harmonious: what to check on your next visit

## Current: connection drawing and inspection

Reload both PCs after the release in [deployment status](deployment-status.md).

- [ ] Open the comparison from `harmonious3.png` with the same branches folded. The long **2 connections · Collapsed branches** line should be gone. A quiet **↔ 2** badge should identify the hidden connections on the collapsed branch.
- [ ] Open that badge. Check that it lists the real node pairs, their owners and parent paths. Multiple judgments on one pair should count as one connection; agreement, counterpart links and earlier comparisons should retain their separate meanings/history.
- [ ] Choose **Show connected nodes**. Both real nodes should become visible at the existing zoom, with unrelated branches still folded. Closing the detail should return keyboard focus to an available connection or node.
- [ ] Expand and collapse several levels. No connection should attach to an ancestor in place of a hidden descendant. A genuine connection between visible nodes should remain. A linked node should still have no Request counterpart option.
- [ ] Check direct lines and small rounded detours in Map/Create, Inquiry, Compare and Argument. Lines should avoid cards. Switching shared modes should preserve source positions and source-edge geometry; radial node placement should remain familiar.
- [ ] In your own map, select a connection using the pointer or keyboard. Its on-map detail should show the real endpoints, meaning and direction. Edit should open the optional panel; removing a reason should retain any separate parent–child organization.
- [ ] Try **View options → Additional connections**. All visible is the default. Hiding additional connections should not replace them with a misleading parent line. Unrelated parent–child branches remain visible.
- [ ] Repeat edge inspection in a narrow window. Close/Escape, Show connected nodes, Edit, and draft-discard cancellation should behave consistently.

## Current: node wording and map editor

- [ ] Check that menus use node, including creation, references, map-change previews and validation messages. Your own authored wording should be unchanged.
- [ ] Open your map: the bottom-left Frame/type labels should be absent, with no replacement author name. Confidence and expansion/add buttons should still work.
- [ ] Select a node: its on-map menu should open. Edit should open the optional panel; Close should return keyboard focus. Saving on-map confidence should keep a closed panel closed.
- [ ] In a shared comparison, the controls should read Inquiry, Compare, Argument from left to right; each should retain its actions and parked drafts.

The collapsed-ancestor connection issue is covered by the new checks above. [The connection drawing plan](connection-drawing-plan.md) records its diagnosis and implementation.

## Current: mode consistency

See [deployment status](deployment-status.md) for publication. Reload both PCs before testing the consistency release.

- [ ] Record a dispute with selected grounds and no comment. Its list preview should identify the grounds; opening it should show every choice.
- [ ] Respond from the other account. The response row should show the actual outcome, and the source's conversation count should not increase for that response.
- [ ] Find the interaction by a selected ground, Other text, or response outcome. Show on map should open its existing detail at the source, with no extra Context card.
- [ ] Try Find in Compare, Inquiry, and Argument. Each mode should retain its query and show only its own interactions. Disputes should include received or answered disputes without implying resolution.
- [ ] Open a badge, Conversations, and a search result for the same interaction. Labels, choices, authorship, and target should agree. A reason badge must not open an unrelated dispute.
- [ ] Open Withdrawn interactions and read their responses. Earlier withdrawn replies and individual outcomes should remain readable from their parent.
- [ ] Switch modes without changing anything else: map positions, zoom, selected nodes, and expanded branches should remain stable. A parked form should return intact.
- [ ] Open earlier records: history should remain available, while retired creation and source-confirmation controls should be absent. Counterpart requests/create/choose and central definitions should still work.
- [ ] Repeat Find and opening an edge interaction in a narrow window; verify keyboard Close/Escape returns focus sensibly.

## Current: redesigned interactions

Reload both PCs after the current release, then open a shared comparison. Use fresh maps if you want a clean start.

- [ ] **Map/Create:** add ordinary nodes and Create reason. A reason should connect toward its conclusion, with one visible edge per pair. Try reason, cause, addresses and enables connections.
- [ ] **Compare:** select the other person's node and record Endorse, Disagree, or No position. It should appear as an attributed attachment without automatically editing either map or requiring a co-sign.
- [ ] **Inquiry:** try Request reason, Request explanation, Propose alternative, and Offer reason. The other account should receive Respond in Inquiry; the sender should not have that response control.
- [ ] **Argument:** choose Dispute reasoning on each frame and a typed connection. Check that the available grounds match the source, citation grounds appear only for cited nodes, Other opens a text field, and internal Signals are absent.
- [ ] Submit a dispute with only one selected ground. Try optional comments and one optional node reference. Choosing an existing reference should not copy it; explicitly creating a reference node should add it to your own map.
- [ ] Respond with one outcome. Accept alone should leave maps unchanged. Use a separate Review/Apply action to make an owned copy, add a reason, or revise your own wording. Copied nodes should default to their original frame.
- [ ] Collapse a branch and reopen its attached interactions. Switch modes while drafting and return to the draft. Check that the controls remain usable in a narrower window.
- [ ] Confirm confidence, central definitions/standards, and counterpart requests still work. A linked node should not offer Request counterpart.

See [the grammar implementation](interaction-grammar-v4.md) for final decisions and prototype limits. The walkthroughs below describe preceding releases; old Ask/Challenge, standalone adoption, reflection/outcome and blank-Inquiry expectations have been superseded or deferred by this redesign.

## Shared-map discovery and conversation overview

- [ ] Open **Comparisons & arguments → Find a shared map** in the Library. Search by a person's name and a map name. Your own maps and other people's private maps should be absent.
- [ ] Choose **Compare with my map**. The other map should be preselected; choose your own map explicitly, then start/open the comparison.
- [ ] In **Argument → Conversations**, find a disagreement point. Check that each person's assessment and next step appear together under it, with no duplicate standalone outcome rows. Missing assessments should remain neutral.
- [ ] Change only a reference link on a source under discussion. The old/current source review should show the changed link. Search for wording in a saved existing-node reason's summary or details.
- [ ] Collapse source branches, find an edge-attached disagreement point, and choose **Show on map**. Its endpoints should become visible without changing zoom.

## Points of disagreement and personal outcomes

Reload both accounts after the release in [deployment status](deployment-status.md). Use a disposable Comparison.

- [ ] In **Argument**, select a statement and choose **Mark point of disagreement**. Save a short description, optionally choosing a category. Close it: a small attached count should remain, without a new graph card or connection.
- [ ] Repeat on a source-map edge, a reason, an Argument response and its **Supports** connection. Each point should identify the actual item it addresses, including when its branch is folded.
- [ ] Open a point and choose **Record my outcome**. Write an assessment and optional next step. Refresh the other account, then record a different assessment there. Both should appear separately with their authors; maps, relationships and challenge resolution should remain unchanged.
- [ ] Edit your own outcome and inspect earlier wording. Your partner should have no edit control for it. Returning to the point should offer **Edit my outcome**, not create a second current outcome for you.
- [ ] Search **Find in argument** for wording in a point, outcome or next step. Showing the result should open the attached note at its real source and preserve zoom.
- [ ] Start a note, switch to Compare, then return. The draft should be preserved, with no critique controls or Argument note counts appearing in Compare. Replacing its target should ask before discarding it.
- [ ] Change the source while the other account has a draft open. Saving should retain the draft and require review of the changed source. Removed sources should remain readable through history while preventing fresh contributions.
- [ ] In **Compare → Ask**, select **What would change your mind?**, customize it and save. It should behave as a normal question. Changing presets should not overwrite custom text.
- [ ] Repeat note and outcome forms in a narrow window. Check that the title, text, optional details, save button and close control remain reachable without overlapping the canvas toolbar.

## Use an existing node as a reason

Reload both accounts after the release in [deployment status](deployment-status.md). Use disposable maps for source edits or removal.

- [ ] In **Argument**, select your own Position and choose **Explain my reasoning → Use one of my nodes**. Search for another position in that frame. Results should identify the parent path, show the conclusion being supported and let you inspect the source wording before saving.
- [ ] Save, wait for **All changes saved**, then refresh the other account. It should see an **Existing node** reason with your wording and authorship. Your source map should have no duplicate, moved node or new structural connection.
- [ ] As the other person, challenge the reason's statement and its **Supports** connection separately. Inspect the invoked definitions and optional source reference. You should not be able to edit the author's reason or see unused library entries.
- [ ] Use the same source position for a different conclusion. Both uses should remain separate and readable. Reusing it twice under the same conclusion, supporting itself or creating a circular chain should be prevented.
- [ ] Edit the source wording. Its existing reason should retain the earlier wording and indicate the change. Open **Review used node**, compare versions and explicitly update it. Earlier reason and challenge history should still show what was addressed then. A confidence-only change should not trigger this review.
- [ ] Begin a node-selection draft, switch to Compare, then return to Argument. The selection should be retained without showing the reason composer in Compare. Repeat at a narrow window width.
- [ ] Explain your own response to the other person's claim using a node from your own map in the matching frame. Other frames, other owned maps and the other person's nodes should not appear in the picker.
- [ ] Remove a disposable source node. The old reason should retain its historical wording and let its author withdraw it; it should not offer to update from a nonexistent source. Making a participating map private should remove the other person's access to that Comparison and its referenced wording.

The [existing-node workflow](existing-node-reasons.md) describes review, retry and privacy boundaries. A source can be reused in separate reason cards; a single shared card with several Supports connections remains future work.

## Start here: Compare, Argument, and finding saved work

Reload both accounts after the release listed in [deployment status](deployment-status.md).

- [ ] In **Compare**, select another person's node or source-map connection. **Ask** should offer explanations, examples, evidence and a free question. No Challenge, fallacy, supporting-reason or contest form should appear there, including through **Conversations**, grouped edges or old saved contributions.
- [ ] Record agreement/disagreement in Compare and request a missing counterpart. Existing counterparts should still suppress a new request. Own-node adoption suggestions belong here too.
- [ ] Switch to **Argument** on the same source. Source selection and zoom should stay steady; source-specific reasons/challenges should be available. Fresh Ask, counterpart and adoption actions should not crowd this mode.
- [ ] Challenge a statement and its **Supports** connection separately. Write the objection first, then optionally expand **Type of challenge (optional)** and choose **Logical fallacy or reasoning error**. A relationship's **Contest agreement/disagreement** belongs in this mode.
- [ ] Type a question in Compare, switch to Argument, then return. Repeat with an Argument draft. Each draft should be hidden in the other mode and restored intact on return; selecting a replacement target must still ask before discarding.
- [ ] Open earlier saved work. An argument reached through a contextual link should switch to Argument. An earlier inquiry needed to understand it should remain readable; unrelated inquiries and adoption receipts should not fill **Find in argument**.
- [ ] Review **Map Library**. Recently edited maps should appear first. Reply in an older Comparison, save and refresh: that Comparison should move ahead of less active work. Cards should count reasons and challenges separately and omit empty count categories.
- [ ] Search the Library for nonexistent wording. It should show a clear empty result; the creation card should not masquerade as a match. Clear the search to restore the normal list.

The [interaction and sorting rules](compare-argument-ui-rules.md) explain the defaults and keep the compass and further outcome tools distinct from already implemented behavior.

## Connections and personal confidence

Reload both accounts. [Deployment status](deployment-status.md) identifies whether this update is live.

- [ ] Revisit the comparison from the screenshot. Expand a branch on one map and leave the other folded. Connections should meet card boundaries without crossing the cards' faces, and their labels should stay on the line.
- [ ] Open a relationship by its label, by clicking its line, and with the keyboard. Its saved meanings and authorship should still be accessible. A displayed node pair should still have only one visible edge.
- [ ] Select one of your own Position nodes in Maps and choose **My confidence**. Save 73%, reopen the normal editor, save an unrelated text edit, and confirm 73% remains.
- [ ] In Compare, change your own confidence using its small percentage badge. Wait for **All changes saved**, then refresh the other account. It should see your score with your authorship, without an edit action for it.
- [ ] Set a score to zero, then choose **Not assessed**. Zero should display as 0%; unassessed should have no score badge. Frame headings, topics and questions should not offer confidence.
- [ ] Change confidence without editing the position. Existing comparison relationships and reasoning should not acquire a source-wording warning, and neither user's other scores should change.
- [ ] Try the confidence form at a narrow width and check that entering a value, backing out and revisiting the map behave clearly.

The optional compass is currently a [design preview](design/map-discovery-compass.html), not connected to live accounts. The broader [process review](process-design-review-2026-09-19.md) separates next features from deferred decisions.

## Folding, finding, and adoption

Reload both accounts after the release and use a disposable Comparison. [Deployment status](deployment-status.md) identifies what is live.

- [ ] Fold follow-ups on a reason's card and on its **Supports** marker separately. Each count should describe what it hides. Open challenges should remain discoverable, and the other person's view should remain unchanged.
- [ ] Add a response from the other account and refresh. Its folded count should increase without opening the branch. Switch modes and revisit the Comparison; folds should remain during the same page session.
- [ ] Begin a response with text, a reference and selected definitions. Fold a different branch and type into **Find in argument**. Nothing in the draft should be lost. A search result that replaces the draft should ask first.
- [ ] Search for a saved response and use **Open challenges**. **Show on map** should identify the real target and keep your zoom. In a large argument, try **Earlier steps**, **Back to selected contribution**, and **Fit argument**.
- [ ] Suggest one of your ordinary nodes for adoption. Only the other map owner should see **Add to my map**, **Use an existing node**, and **Not now**.
- [ ] As the recipient, choose **Add to my map**, edit its wording and select a parent. Leave **Link as counterparts** unchecked once; select it in another example. Both choices should create your independent node without recording agreement or a co-sign.
- [ ] When the source uses definitions, expand its definition section. Copy one selected version to your library and leave another unselected. Confirm only the selected version is invoked on your node and that later edits stay separate.
- [ ] Try **Use an existing node** and confirm its wording and definitions remain unchanged. Try **Not now**, then reconsider the same suggestion.
- [ ] While the recipient has an adoption draft open, change the source in the author account. Saving should show the old and updated source for explicit review while keeping the recipient's draft.
- [ ] After fulfillment, use **Open node**, edit the copy, and revisit its receipt. It should say **Changed since adding**. A deleted copy should say **Removed from map**, without another Add button. Withdrawing the original suggestion should not remove a saved copy.
- [ ] Repeat the search and adoption flows at a narrow window width. Report any unclear labels, overlapping controls, or excessive scrolling.

## The current Argument workflow

Use a different signed-in account on each PC or browser profile. Reload after the update is deployed, use disposable test maps, and wait for **All changes saved** before refreshing the other account. See [the current Argument guide](current-argument-workflow.md) for the intended behavior and remaining limits.

- [ ] Open the same Comparison from both accounts. **Compare** and **Argument** should be modes in its toolbar, without requiring a proposal or shared question.
- [ ] As account A, switch to **Argument**, select your own ordinary source node and choose **Explain my reasoning**. Add a reason with an optional reference link. Confirm account B sees the saved reason, its author, and its **Supports** connection after refreshing. Neither original worldview should acquire a new node.
- [ ] Open your reason and choose **Add supporting reason**. Follow the two-step chain back to the source. Reasons should have their own **↳** count, not increase the **!** challenge count.
- [ ] As account B, try three distinct actions: **Challenge** the original source node, **Challenge reason** on its reason card, and **Challenge reasoning** through the **Supports** connection. Each contribution should identify the correct target; the last should let you inspect both the reason and conclusion.
- [ ] As account A, **Respond** to a challenge, include a reference link, and add a supporting reason to your response. As B, challenge that response. Use parent links and **Back to source** to retrace the exchange.
- [ ] Choose **Accept challenge** or **Maintain position** as the recipient. The challenge should remain open until its author chooses **Mark resolved**. Reopen it as that author. None of these actions should change agreement/disagreement between the source nodes automatically.
- [ ] Invoke a library definition or standard on a reason, challenge, and Argument response. Read the exact selected version through the definition icon from the other account. Edit the library entry; existing contributions must keep their chosen version, and the other account must not see uninvoked wording.
- [ ] Use **Follow argument**, **Fit argument**, **Collapse argument**, and the source indicators. Collapse a source-map branch. Its argument counts should remain discoverable in Argument, while Compare shows only its relevant inquiries. If several source conversations share one collapsed indicator, confirm you can choose among them.
- [ ] Type an unfinished reason, switch **Argument → Compare → Argument**, and check that its text and selected definitions are restored after being hidden in Compare. The mode switch should preserve the camera and selection. Trying to leave the draft should ask before discarding it. Save before reloading: unfinished forms do not survive a reload.
- [ ] Edit a reason that has been challenged, then edit its source position. Check **Source wording & history** from the other account. Original wording must remain intact; a connection challenge should retain both original endpoints and indicate relevant source changes.
- [ ] Withdraw a reason with a response or challenge beneath it. The active descendants should remain reachable through a labeled historical parent. The other author should still be able to withdraw their own child contribution; adding or rewriting contributions against unavailable sources should fail.
- [ ] On a busy test argument, confirm that no more than 40 cards appear at once and that displayed children keep their necessary parents. **Browse all … contributions** opens the searchable list; use **Show on map** and **Earlier steps** to reach the rest. Repeat normal navigation at a narrow window width and with the keyboard.
- [ ] Make one source map private, then refresh the other account. The inaccessible conversation, references, invoked definitions, and any open contribution window should disappear there. Restore sharing when finished.
- [ ] After both accounts report **All changes saved**, reopen the Comparison and verify the chain, authors, outcomes, and histories. Existing proposal-based work should still open through **View options → Earlier reasoning** where available.

## Then check: missing counterparts

Reload both PCs before trying the new flow.

- [ ] Select a node that already has a counterpart. **Request counterpart** should be absent from both its action window and counterpart chooser.
- [ ] Check an example connected to its parent, and a counterpart pair with an agreement. Each node pair should have one visible line. Open the line's label/details to inspect saved meanings. Opposing judgments should show **Mixed judgments**; collapsing branches should not duplicate the line.
- [ ] Select a non-frame node with no linked counterpart. Confirm a dashed **No counterpart linked** spot appears beside it on the other user's side.
- [ ] Send **Request counterpart**, then refresh the other account. Confirm the empty spot persists.
- [ ] As the recipient, choose **Create counterpart**, select its parent in your own map, and enter your wording. After saving, open your own map and confirm the node is there.
- [ ] Repeat with **Choose existing node**. Confirm it links the selected node without creating a duplicate.
- [ ] Confirm a neutral **Counterparts** connection appears and no agreement/disagreement was recorded automatically. Within a frame, the pair should sit together; neither map's original parent connections should change.
- [ ] Respond **No position yet** or **Not applicable** to another request. Confirm the large spot collapses to a status indicator. Reopen it from the requesting account.
- [ ] Start a new counterpart draft and try closing it. Cancel the discard prompt and confirm your wording is preserved. Try the flow on a narrow window too.

See [the counterpart workflow](counterpart-workflow.md) for cross-frame and multiple-link behavior.

## Earlier release: the three new features

Reload both PCs and use a different signed-in account on each. Wait for **All changes saved**, then refresh the other account after each change.

- [ ] Ask a question about the other person's node. Open and close its **?** counter; the question should stay attached to that source.
- [ ] Challenge a node, an edge and a recorded relationship. Their **!** counters should open the relevant conversations. Collapse Inquiries/Arguments and a source branch; the counters should remain discoverable.
- [ ] Open **Map Library → Definitions & standards**, create an entry, then invoke it on your own node using **Use definitions & standards**. The other account should read its wording through the source's definition icon.
- [ ] Edit the library entry. The existing source should still use the earlier wording until you explicitly choose the newer version. The other account should not see unused entries or uninvoked wording.
- [ ] Open **Argument**, follow a challenge and its responses, and use a response's parent link. Check that you can tell who said what and what they were responding to.
- [ ] As the recipient, **Accept challenge** or **Maintain position** with an explanation. The challenge stays open until its author marks it resolved. Reopen it as the author and confirm the history remains.
- [ ] Repeat opening and closing attachments at different zoom levels and on a narrow window. Note anything that covers too much of the map or makes it hard to find the source.

See [the workflow and remaining boundaries](attached-conversations-library.md).

## Compact header and map ownership

- [ ] Reload the site, open a Comparison and check the space above the canvas. On a wide window, the Harmonious logo and Map Library/Maps/Comparisons/Pods should share one row; the comparison pair and its actions should share the next.
- [ ] Confirm that each map is named with its owner in the second row. Its nodes should use the same blue or amber left edge and show the owner's name at the bottom. Green, blue and purple top edges should still identify Status Quo, Transformative Action and Goal State.
- [ ] Reverse the two selected source maps while starting a disposable comparison. Each map should keep its ownership color even when it changes from the first position to the second.
- [ ] Open **View options**. Source choices, frame/expansion controls, map highlighting, Earlier records and any compatible earlier Argument view should remain available there.
- [ ] Try **Full canvas** and confirm that Exit and save status remain visible. On a narrow window, the header may wrap, but the page should not scroll sideways and the canvas should remain usable.

## New canvas, history and argument checks

- [ ] Open View options to change frames, expand branches or find Earlier records. The normal toolbar should leave more map space.
- [ ] Open a compact conversation marker, then close it. Try Full canvas while typing; the draft and save status should remain available.
- [ ] Open a relationship from the account that did not record it. Confirm **Contest agreement** or **Contest disagreement** is present and generic Reply, Support and Add evidence actions are absent.
- [ ] Edit a source after recording a relationship. Reopen the relationship, read original/current wording, and choose **Confirm current source wording** inside Source wording & history under the contribution author's account. The original wording should remain preserved.
- [ ] Inspect an older contribution. If its source was never captured, it should say so rather than claiming the current wording is historical.

Full behavior and boundaries are in [canvas, source history and on-map arguments](canvas-history-arguments.md).

Use https://harmonious-beta.tlrdevere.workers.dev/. Two PCs, or two separate browser profiles, are best: sign into a different account on each. Two ordinary tabs usually share the same sign-in.

Start by reloading the page. Download a backup before experimenting, and use clearly named test maps or proposals for changes you do not want in your real work. After each saved change, wait for **All changes saved** before reloading or closing the page.

## New on-map comparison workflow

- [ ] Open a Comparison, select one node in each map and choose **Agreement** or **Disagreement** beside the selection. The labeled connection should appear after one person's action, without a question or co-sign step.
- [ ] Open that connection, choose **Edit**, and add a description. Check that the other account sees the author's name and description after refreshing.
- [ ] Select your own node and **Request counterpart**. Check that the other person can read and respond to the request.
- [ ] Select your own node and **Suggest adoption**. Check that the other person can read and respond to the suggestion.
- [ ] Select the other person's node and **Ask**. Try explanation, example, evidence and a freely worded question.
- [ ] Select an edge and **Challenge**. Try a general challenge, Reasoning does not follow, Counterexample and Logical fallacy or reasoning error. Repeat on a node or a relationship between maps.
- [ ] If an older node has definitions or standards, confirm **View definitions & standards** still opens it. New per-node definition creation should not be offered.
- [ ] Toggle **Inquiries** in the toolbar and **Map** / **Arguments** under **View options** independently. Open an attached conversation, respond, and use **Fit both** if needed to see all sources.
- [ ] Start typing a contribution, try leaving, and cancel the discard prompt. Your draft should still be present.
- [ ] Reopen the Comparison after both accounts report **All changes saved**. Verify your relationships, requests, questions, arguments and replies remain.
- [ ] Check that the previous judgments remain under **Earlier records** and that existing Argument links still open their earlier view.

Dragging nodes and rearranging maps are deliberately deferred.

## Library and navigation

### Cleanup checks from September 11

- [ ] Open **Earlier records**, then use **Close records** and Escape. The map keeps its width, focus returns to the opening control, and an unsaved earlier judgment remains intact.
- [ ] Focus two nodes, record a relationship or inquiry, and check that saving does not unexpectedly zoom out. **Fit both** still deliberately shows the wider map.
- [ ] Relationship labels do not cover source-node titles. Selecting or focusing a node does not move the canvas independently of pan/zoom.
- [ ] On a narrow screen, scroll the optional conversation panel to reach its save action. Note where the header or toolbar still leaves too little working space; this remains a design priority.

- [ ] A fresh visit opens **Map Library**. No map canvas appears until you choose a map; a saved direct link still opens its specific map or comparison.
- [ ] **My maps** shows your maps. Open one, return to Library, and create another using **Create map**. New account maps start private.
- [ ] **Comparisons & arguments** lists overall map pairs. **Create comparison** lets you choose your own and another accessible map. Shared maps are choices here, rather than a separate top-level tab.
- [ ] Inside a Comparison, **Compare** / **Argument** choose its focus. **Inquiries** and the **View options** visibility controls manage clutter. Earlier judgments and **Earlier reasoning** remain available for existing records.
- [ ] **View source map** opens the source and its co-sign/copy controls. The back button returns to Comparisons. Co-sign history remains available here.
- [ ] The account menu, opened using your name, contains refresh, import, backup, save and sign out.
- [ ] **Pods** lists the existing derived views. It clearly explains that these come from co-signs; independent pod authoring remains undecided.

## Actions on your map

- [ ] The **+** at the bottom of a node opens a child-type chooser. Create a Question or Position and edit its wording in the inspector.
- [ ] Selecting a node shows its nearby action menu. Try Edit, Add child and Connect. More exposes co-sign history and deletion; deleting a branch still asks for confirmation.
- [ ] Compare in the node menu carries that map and node into the source picker. Add reasoning appears only when the node belongs to the selected comparison proposal.
- [ ] Keyboard activation and a narrow browser window work. On narrow screens, selecting a node shows actions first; Edit opens the full inspector.

## First: your existing work

- [ ] Both accounts can sign in, and each Library shows the correct person's maps.
- [ ] Your existing map wording, branches, comparisons and judgments are still present.
- [ ] Pan, zoom, expand/collapse and Fit behave sensibly. Text is readable at your normal window size.

## Earlier comparisons: compatibility checks

- [ ] Share one test worldview from each account using Map settings. From account A, compare those two maps. Account B should find the same overall Comparison under Comparisons in Library.
- [ ] Opening it from the opposite account does not create a duplicate overall Comparison. The main list shows map pairs; opening a pair shows its proposed judgments.
- [ ] The maps overlay within the same frames. Highlight A/B makes authorship clear. Nearby nodes are candidates, not automatically accepted counterparts.
- [ ] Select two nodes and record a proposal. Account B can find it and record a separate judgment. One person's response does not overwrite the other's.
- [ ] Try agreement and disagreement. **Both agree** should appear only when both people have reviewed matching questions, relationships and current source wording. Older judgments may first require source review.
- [ ] Try clarification on a divergent pair: each person writes a response, then each confirms after reviewing both responses. Changing a response should require renewed confirmation rather than silently preserving agreement.

## Earlier Argument view: compatibility checks

- [ ] Select a recorded proposal and choose **Open Argument for this proposal**. The correct question, source positions and proposal version should appear.
- [ ] As account A, add a Ground and Evidence. Include an explanation and a reference link. Connect them using **Supports** and **Evidence for**. The new cards should be visible after saving; **Fit reasoning** should bring the reasoning into view.
- [ ] As account B, find those contributions, add a Value or Ground, and create a **Rebuts** connection to a reason from A. Confirm that the arrows and author labels make sense.
- [ ] Each person can edit their own contributions and read the other's. They should not be able to change the other person's wording or connections. Adding reasons should not change either original worldview.
- [ ] Edit a reason that the other person connected to. The existing connection should show **Needs review**. Its history should retain the earlier endpoint version; the connection's author can review and save against the revised reason.
- [ ] Withdraw a test contribution, then undo it. Check that history survives. Undo is limited to changes on the current page/context; it is not a permanent account-wide undo list.

## Earlier Argument: return to it later

- [ ] Start an unfinished form, switch between Compare and Argument, and return. The draft should still be there. Leaving for a different task should warn before discarding it. Save the form before reloading: unfinished drafts do not survive a page reload.
- [ ] After **All changes saved**, reload both accounts. The same reasons, connections, authors and histories should remain.
- [ ] Copy the address while viewing Argument and open it in the other signed-in account. It should open the same proposal/version when that account has access.
- [ ] On a disposable proposal, change the proposed question or source wording. Earlier reasoning should remain under its original version and be marked for review, rather than silently moving to the changed question.
- [ ] Download a backup. It should include comparisons and arguments. Opening it in the portable demo preserves that history; importing into a signed-in account currently imports private map copies only.

## Things to judge about the current workflow

- Is it obvious which position or reasoning connection you are addressing and who authored each card?
- Is the transition from Compare to Argument natural?
- Is the distinction between challenging a position, a reason, and a reasoning connection clear?
- Does the layout help you follow an argument, or do the placement and number of expanded cards get in the way?
- Is agreement prominent enough, and does **Needs review** explain the next step clearly?

The current Argument mode has automatic positioning and authored challenge outcomes. Individual card dragging, arbitrary graph links, and merged agreement cards remain deferred. Pod design is also deferred. The separate Ground/Evidence/Value graph is the earlier compatibility view.

If something fails, note the account label (A or B), map/proposal name, the action you took, what you expected, and what happened. A screenshot and the visible error text are useful. Do not share sign-in codes or private keys.


## Short two-person example

Use disposable maps to discuss whether a community meeting should be in the evening.

1. Alice adds “Hold the meeting in the evening.” Bob adds “Hold it during the day.” Create/open their shared Comparison.
2. In Compare, Bob asks Alice what evidence would change her mind. Alice answers with a concrete condition, such as a representative attendance survey.
3. In Argument, Alice explains her position: “Most respondents preferred evening.” She can add a supporting reason about the responses received, or use an existing position from her map.
4. Bob selects the Supports connection and challenges whether the respondents represent all members. A challenge to the statement itself should attach to the reason card instead.
5. Alice responds. Mark the disagreement as the representativeness of the sample, then let each person record their own assessment. Alice might need more evidence while Bob understands the difference; neither outcome changes the other's map or automatically resolves the challenge.
6. Open Conversations and find that point, both assessments and their next steps together. Fold the branch and use Find in argument to return to it. Refresh the other account and verify the same saved conversation.

Automated local workflows cover the mechanics with disposable accounts. This walkthrough is for judging whether the wording, targets and next actions are understandable to a person using the prototype.
