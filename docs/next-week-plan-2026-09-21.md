# Harmonious: proposed work for September 21–25, 2026

The main goal is a usable Argument mode inside the shared Comparison: someone can explain a position, another person can challenge the claim or its reasoning, and both can follow the exchange on the map. This is a priority order and an estimated five-day sequence, not a promise that every stretch item will fit.

## Starting point

Current Compare already supports agreement/disagreement, counterpart requests and direct fulfillment, source-attached inquiries and challenges, nested responses, author-controlled challenge outcomes, and reusable definitions/standards. The latest fixes hide counterpart requests when a link exists and combine multiple connection meanings into one visible edge per node pair. These need acceptance checks, not rebuilding.

Argument currently has two implementations. The earlier version contains reasoning cards and links but depends on old proposal/version records and a separate interface. The current on-map system has the simpler interaction we want, but presents conversations rather than an explicit graph of reasons. The week's work should bring the reasoning capability into that current workflow. Preserve earlier records and history through a clearly identified compatibility path; do not silently convert them or make proposals a prerequisite again.

## 1. Stabilize Compare and settle the Argument design — day 1

- Verify the latest counterpart and single-edge fixes with two accounts, including collapsed branches, mixed judgments, and connections with several saved meanings.
- Check that source ownership is clear, selected items remain visible, and opening a conversation does not obscure the whole canvas. Fix concrete failures before adding more interface.
- Define the small Argument vocabulary: **position**, **reason**, **challenge**, and **response**. Keep inquiries available as questions, rather than treating every question as an objection.
- Use two modes within the same Comparison: **Compare** and **Argument**. Compare emphasizes the source maps and their relationships; Argument emphasizes the selected reasoning chain while retaining its source context. Mode switching preserves selection, camera, expansion and drafts. Avoid adding another full header row.
- Review and checkpoint the accumulated local work so subsequent Argument changes have a recoverable baseline. Identify the boundary between current discussions and the earlier graph before changing storage.

## 2. Build the core Argument workflow — days 2–3, highest priority

### Explain a position

Selecting one's own source node offers **Explain my reasoning**. The author writes a short reason and optional detail. A position may have several reasons, and a reason may itself have supporting reasoning. These are contributions to the shared Comparison; creating them does not silently add or modify worldview nodes.

Use a visible, consistently directed connection from the reason to the claim it supports. Begin with a few connected steps rather than requiring a complete formal argument before saving.

### Challenge the claim or the reasoning

The other participant can challenge a claim, a reason, or the connection that says a reason supports a claim. This distinction matters: “I disagree with that statement” is different from “That reason does not establish that conclusion.”

Reuse the simple challenge composer with plain-language text and optional reasoning-error labels. A fallacy label represents the contributor's judgment, not an automatic verdict. Keep **Contest agreement/disagreement** specific to a recorded relationship.

### Respond and continue the argument

An author can answer a challenge with an explanation or further reasoning. The other person can challenge that response. Each contribution identifies its author and exactly what it addresses. Users can follow the chain backward to its source rather than searching a long list of detached replies.

### Include evidence and definitions without extra menus

A reason or response can include an optional source link and an explanation of how it supports the point. Reuse the definitions/standards library and expose the exact invoked wording through its existing icon pattern. Extending references to reasoning contributions must preserve author ownership and explicit versions.

Do not restore generic **Support**, **Add evidence**, or **Reply** actions to agreement popups. Evidence belongs within the relevant explanation; asking for evidence remains an inquiry.

### Preserve meaningful outcomes

Retain **Accept challenge**, **Maintain position**, and challenger-controlled resolve/reopen, with explanations and history. Distinguish a response having been posted from a challenge having been resolved. One person's acceptance or resolution must not be described as agreement by both people.

Editing or withdrawing one's own contribution preserves its earlier wording. Source changes should be apparent when relevant without introducing a mandatory review ceremony before every action. Missing or private sources must not leak new information.

## 3. Make the reasoning readable on the canvas — day 4

- Expand a compact group of reason, challenge and response cards attached to the selected source. Keep the source identifiable and provide a clear way back to it.
- Use modest visual distinctions between these card types, while retaining author names and the existing ownership colors. Do not rely on color alone.
- Collapse a branch back to persistent counts, so users can see that reasoning or unanswered challenges exist even when its text is hidden.
- Provide **Follow argument** and **Back to source** navigation. Opening one focused chain should avoid filling the map with every conversation at once.
- Keep one visible edge per displayed pair, with underlying meanings available in its details. Apply the rule to new reasoning connections as well as existing map connections.
- Use automatic placement; handle narrow windows, zooming and collapsed source branches. Do not add manual dragging this week.
- Keep optional secondary details out of the primary flow. No mandatory question definition, proposal, or co-sign step.

## 4. Test, tidy and release the complete flow — day 5

The acceptance scenario is: **Taylor explains a position → the other participant challenges the reasoning connection → Taylor responds with a reason and reference → both reopen the same chain → the challenger resolves or reopens it.** Repeat with a challenge to the claim itself so the distinction is visible.

Verify persistence after refresh, author-only edits, source wording changes, hidden/private maps, historical records, draft protection, keyboard access, narrow layouts and dense comparisons. Confirm that source maps remain unchanged unless their owner explicitly edits them.

Extract the new Argument controller/display from the growing conversation UI as it is built. Remove superseded entry points from the main flow once the replacement works, retaining access to older saved arguments. Update the testing checklist and clearly mark historical design documents so they no longer appear to describe the current workflow.

Run the existing application, account, browser, export and release checks. Establish a repeatable release checkpoint and add continuous checks where the repository setup permits. Deploy only the coherent, verified slice and record its status.

## Secondary maintenance and stretch work

- Address the development-tool advisories recorded in the September 11 dependency review through compatible, tested updates. Revisit the software-inventory disclosure preference before any new registry audit; this planning task does not run one.
- If the core workflow is complete early, improve finding open challenges within a busy comparison. Treat this as navigation over the new flow, not a separate notification system.
- Adoption fulfillment remains useful follow-up work, but should not displace Argument mapping this week. The current suggestion must not silently copy a node into another person's map.

## Hold for later

Manual node dragging/rearranging; pod-map derivation and design; automatic merging of users' nodes; reusing one reason across unrelated argument threads; formal premise bundles; multiple pinned conversation windows; AI interpretation; and live notifications.

The week's minimum successful outcome is one understandable, saved, two-person **position → reason → challenge → response** flow on the shared comparison map, including challenges to reasoning connections. Polish and stretch work should follow that complete path.

## Reference

- [Current attached conversations and definitions](attached-conversations-library.md)
- [Counterpart workflow and single-edge behavior](counterpart-workflow.md)
- [Earlier Argument implementation](argument-view.md)
- [Owner's acceptance checklist](user-testing-checklist.md)
- [Dependency follow-up](dependency-review.md)
- [Deployment status](deployment-status.md)
