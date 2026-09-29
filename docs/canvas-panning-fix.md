# Canvas dragging and browser text selection

The owner reports that left-button drags on empty canvas frequently select text from other elements and stop moving the map. This affects the shared comparison canvas and the independent Map/Create canvas.

Status: reproduced and implemented; all 49 local release checks pass. Hosted verification and publication are next. Worker 50 remains the published baseline. [Deployment status](deployment-status.md) records publication.

## Cause and correction

Both pointer handlers capture the pointer and update the camera without cancelling the browser's default text-selection gesture. Pointer capture alone does not prevent native selection or dragging. The editor also lacks capture-loss cleanup; neither implementation clears all gesture state when the window loses focus.

Real-mouse baseline reproduction confirms that empty-canvas drags select unrelated text in Map/Create, source browsing and shared comparisons. Starting a drag over an already-selected source/comparison hint triggers native `dragstart`, followed by `pointercancel` and capture loss: the camera moves only 18 pixels of a requested 450-pixel horizontal drag. The browser has taken over the gesture, explaining the apparently intermittent stall.

An accepted empty-canvas gesture must cancel its default action and focus the canvas for keyboard navigation. Selection suppression applies only to the canvas during that gesture. Nodes, counterpart placeholders, reasoning cards, controls, links and editable content must retain their own interactions. Do not clear the document's existing selection or disable text selection permanently.

Both canvases must release and reset their tracked gesture on pointer cancellation, capture loss, window blur or a hidden document, and recover if a mouse move shows the primary button is no longer held. Remaining touch pointers retain the existing pan/pinch behavior.

## Acceptance

- Use real left-button mouse drags across selectable canvas labels, with and without a pre-existing browser text selection. The camera should follow the full drag without extending text selection or triggering native dragging.
- Cross node/control areas, leave the canvas, release, and start another drag. Confirm the gesture ends cleanly and does not stick.
- Cover Map/Create, source browsing, Inquiry, Compare and Argument. Preserve zoom, geometry and source data.
- Check capture loss, cancellation and focus loss. Confirm normal keyboard navigation, zoom controls and touch pinch remain available.
- Select and edit text in node-face editors and detail panels; controls and card interactions must not start canvas panning.

The fix changes interaction handling only. It does not change node positioning, counterpart semantics, saved data, dependencies or the deferral list.

The new `tests/canvas-pan-browser.test.mjs` uses genuine mouse gestures, including an already-selected canvas hint, exact camera displacement, unchanged browser selection, native selection/drag event checks, outside release, interrupted capture and node-face text editing. The release runner discovers it automatically, bringing the full suite to 49 checks.

All **49/49 local release checks passed**, including nine browser suites, database/account checks, portable export, production build and complete asset checks. Report: `build/verification/2026-09-29T00-24-39-633Z-97312/summary.json`; Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows. The new browser suite also verifies touch pinch and dragging in the exported standalone file. The older Argument controller test's minimal DOM adapter now exposes window/document event targets for the new cleanup listeners.
