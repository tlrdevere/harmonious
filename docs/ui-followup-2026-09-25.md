# Node wording, map editor, and connection drawing

September 25, 2026. This follows the owner's review of the mode-consistency release. See [deployment status](deployment-status.md) for the published version.

## Implemented interface changes

- Use **node** for the interface entity throughout Map/Create, Inquiry, Compare, Argument, references, map-change previews and validation messages. The earlier `c0381c8` redesign labeled ordinary nodes Statement when removing Topic/Question/Explainer creation choices. The supplied terminology key describes a Node as a statement; that did not require renaming the interface entity. Saved types, identifiers and authored content remain unchanged.
- Remove the redundant node-kind footer from Map/Create, including Frame on the three root cards. There is no replacement author label. Confidence and expansion/add controls retain their places.
- Order the shared mode controls **Inquiry → Compare → Argument**. Existing mode restoration and mode-specific actions remain intact; this is a navigation-order change.
- Keep the Map/Create detail panel optional: selecting a node opens its on-map menu; Edit opens the panel. Once explicitly open, the panel can follow selection. Creating or connecting nodes still opens the relevant form. A Close action returns keyboard focus to the selected node. Saving on-map confidence does not force the panel open.
- In signed-in account mode, the editor says Node updated rather than incorrectly demanding a manual workspace save. The global save indicator continues to report actual autosave state. File/offline workflows retain their save guidance.

## Browser discrepancy investigation

**Follow-up:** the owner subsequently supplied `harmonious3.png` and confirmed the line appears in both browsers. The browser-specific concern is closed. [The connection drawing plan](connection-drawing-plan.md) identifies the misleading collapsed-ancestor aggregation shown in that screenshot and supersedes the outstanding diagnosis below.

The owner's exact case remains unconfirmed. A disposable two-map/account fixture produced identical coordinates, connection paths, label sizes/positions and source paths in Chrome and Edge across nine corresponding states: initial, expanded, refreshed, wide viewport, selected source, reloaded and historical-proposal cases. Both browsers reported no page errors. Diagnostic artifacts are in ignored `build/edge-browser-probe.mjs` and `.json`; no live account was modified.

The following mechanisms can change what appears within the same named Comparison:

1. In-app Refresh updates saved data while retaining expansion, filters, selection and camera. It can also defer refresh while work is unsaved, a save is running, or a dialog is open. A full browser reload and the app's Refresh are different actions.
2. An overall `#comparison=…` link and an older `#comparison=…&proposal=…` link restore different source selections. The latter expands historical sources and can reverse map sides; that distinction survives reload. This was reproduced in both browsers.
3. Connections to folded descendants are grouped at their visible ancestors. In the fixture, expanding both maps changed one grouped cross-map edge into two distinct edges, without changing the saved relationships.

There is no browser-local persistent canvas setting in the production code. Different URLs/view states are possible explanations, not a diagnosis of the owner's two windows. If the difference recurs, paired screenshots showing the address bars, visible nodes and View options will help identify the actual state.

## Why straight lines and radial arcs coexist

This is connection routing, distinct from node positioning. The radial node solver remains unchanged.

- Source hierarchy links from a frame to a child are straight. Deeper links use line–arc–line paths when there is enough outward spacing; otherwise they fall back to straight lines. Expansion changes the layout geometry and can change which branch of this rule applies. The probe reproduced the same source edge switching from arc to straight after expansion alone.
- Typed connections in the shared canvas currently use straight source routes. The Map/Create editor uses a different curved path for those connections.
- Cross-map agreements/counterparts use a separate router to avoid node cards and place labels. Rounded corners do not convey any additional agreement, confidence or reasoning meaning.

No routing or node-positioning algorithm changed in this release. The next visual cleanup should adopt a consistent routing policy across Map/Create and the three shared modes, including stable attachment points, quiet styling, card avoidance and one visible edge per node pair. Review representative before/after examples first; choosing how much radial arc structure to retain is a visual design decision. A compact reset-view action and consistent side ordering for older proposal links are also reasonable follow-ups. None requires altering saved maps or enabling manual dragging.
