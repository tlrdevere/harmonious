# Full-size counterparts and room for straight connections

The owner's feedback after Worker 49, including `harmonious 12.png` and `harmonious 13.png`, changes the layout priority. **Status: implemented; all 48 local release checks passed. Hosted verification and publication are next.** The latest request supersedes Worker 49's compact ghost dimensions and area-minimization preference. Publication remains recorded in [deployment status](deployment-status.md).

## Requested behavior

- Ghost counterparts have the same 252 × 166 dimensions as real cards, with the same 16-unit internal gap as an actual pair. A dashed outline, counterpart status and owner caption distinguish the placeholder. It remains display-only and never counts as a saved node or a sent request.
- Keep the radial arrangement and expand the occupied canvas as needed. Move groups and branches outward to clear straight parent-to-child connections, considering both actual parent cards and every real/ghost obstacle. Readability and clear connections take precedence over packing the canvas tightly.
- Clear source connections stay straight even when they cross another line. The comparison router must not introduce a detour simply to avoid a line crossing. An exceptional obstructed connection retains the existing safe route instead of crossing a card or disappearing; this does not promise a crossing-free drawing of arbitrary saved relationships.
- Adjacent recorded pairs use a short straight connection between the real cards. Their wide attribution label must not force an above-card bracket. The connection remains keyboard/click accessible, with saved meanings and authors in inspection. Conversation attachments retain the actual connection's midpoint as their anchor.
- Per-node and toolbar expansion/collapse retain zoom and a visible anchor. Changing a comparison's frame filter also retains scale. Initial overview, explicit **Fit**, and explicit focus/reveal remain separate navigation actions. Growth does not change card dimensions.
- Keep existing explicit-pair eligibility, ownership, requests, history, source maps, selection, draft safeguards and shared-mode consistency. Map/Create and ordinary single-source browsing retain their existing layout/routing policy.

## Verification

Use the actual mixed case represented by screenshot 13: two five-child SQ maps with only the Low union density nodes linked. Check the same case with the opposite branch collapsed, matching screenshot 12. Verify straight boundary-to-boundary parent lines clear every unrelated real card and ghost, as well as full-size controls, actual endpoints, line inspection, both owners, mode changes, zoom retention, and cold reload.

Also check four, six and eight children, unequal maps, nested branches, deep chains, frame filters, and repeated linking/withdrawal. The solver must be deterministic and bounded, with no invisible slots, source mutation, or exponential growth on a skinny chain. Inspect overview and readable working-zoom captures on desktop and narrow screens; a smaller canvas is no longer the acceptance target.

## Implementation evidence

Full-size ghosts share the real card's dimensions and pair gap. The layout tests 24 bounded radial candidates against actual source-card and ghost rectangles, prioritizing clear parent paths, then same-frame additional source relations, then connection length. Separate owner sectors retain a coherent arrangement when both maps have branches. Additive ring spacing prevents exponential growth on a long chain. Extra cross-frame relations and any remaining obstructed paths are reported separately from clear parent paths; their existing safe rendering remains available.

Focused layout tests pass independent straight-boundary geometry checks for the screenshot cases, unequal maps, nested branches, a 98-node forest, a 100-level chain, and 40 children. Straight-preferred routing retains semantic direction, card avoidance, stable caches and shared hit geometry. The portable browser check passes full-size equality, straight sample parent lines, mode geometry, explicit linking, cancellation and real-node preservation. Browser checks cover the paired gap connection, saved authors/attached replies, keyboard return, scale retention, and desktop/narrow screens. Final release counts and publication are recorded in [deployment status](deployment-status.md).

All **48/48 local release checks passed**, including eight browser suites, account/database checks, standalone export, production build and complete asset checks. Report: `build/verification/2026-09-28T23-36-33-825Z-74388/summary.json`; Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows. The final portable browser check and readable desktop/narrow screenshots also passed review. Hosted verification and publication follow on this exact application revision. No data migration, production account write, dependency update, or deferral-list change is required.
