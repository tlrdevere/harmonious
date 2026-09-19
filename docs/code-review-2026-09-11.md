# Code review and update readiness — September 11, 2026

**Follow-up:** the user approved the dependency lookup and the first three product steps. See [dependency results](dependency-review.md) and [canvas, history and arguments](canvas-history-arguments.md). The findings below retain the original review context.

## Outcome

The core account, mapping, comparison, conversation and earlier Argument paths pass their regression checks. This pass fixes verified defects and clarifies the release process. It does not mean the mobile or dense-map design is finished, and it is not an independent security certification.

## Reviewed areas

- Map structure, automatic layout, shared comparison identity and portable workspace validation.
- On-map relationships, inquiries, counterpart requests, arguments, definitions, replies and editing history.
- Earlier proposal judgments, elicitation, versioned Argument records, co-sign/copy behavior and derived pods.
- Account projection, ownership enforcement, optimistic saves, session/origin handling, request limits and database access boundaries.
- Library routing, draft protection, comparison camera, overlays and narrow-screen behavior.
- Production asset packaging, local release checks, portable exports and the retained Sites demo path.
- Current documentation, release evidence and the remaining design decisions.

## Fixed in this pass

| Issue | Change and evidence |
| --- | --- |
| Layer controls added height on top of a 100%-height comparison surface | The canvas container now allocates height between controls and the surface. Browser tests check the surface stays inside its container. |
| Focusing an offscreen node could scroll the transformed surface independently of the camera | The comparison surface clips overflow without creating a scroll container. Browser tests check focus does not introduce a separate scroll offset. Panning and zooming remain camera operations. |
| Earlier records had no close control and drawer state was spread across controllers | The drawer owns its open/close state, provides a sticky Close records button, closes with Escape and restores focus. Opening it does not resize the map. Closing it preserves any earlier judgment draft. |
| Saving a contribution fitted every map and card again | Saving keeps the current camera. Fit both remains an explicit action. |
| Relationship badges could cover node titles; fitting omitted their bounds | Badges are centered, avoid occupied card rectangles and contribute to fit bounds. Relationship lines begin at card tops. Browser tests check label/card overlap. |
| A closed conversation retained a stale record ID for refresh | Closing clears the active record ID. |
| Invalid imported conversation chains could be cyclic or unanchored | Validation rejects missing or cross-comparison entry targets, cycles and unexpected second sources. Entry-chain positioning is iterative. Tests cover malformed imported workspaces. |
| Build, built-Worker checks and live checks had different asset lists | One explicit client asset allowlist now drives all three. Checks compare every asset's exact content, including the transformed account homepage. |
| The legacy Sites build manually concatenated an incomplete module list | It now follows imports through the bundler and checks for its missing deployment manifest before generating output. This independent checkout has no Sites manifest; that hosting path is not a tested deployment target here. |

## Verification

- All 18 application/account test scripts pass, including isolated SQLite and PostgreSQL checks, atomic rollback, private data projection, author boundaries, concurrent saves and preserved histories.
- Both browser suites pass using isolated Alice and Bob accounts and the actual account policy. Coverage includes Library, direct links, drafts, shared contributions, earlier judgments/Argument, source copying, pods and mobile.
- Portable exports were regenerated before testing their browser startup; those checks did not use a stale export.
- The production Worker builds and its routing, complete asset contents, module imports, account gate and response-header tests pass.
- Desktop and 390px-wide screenshots were inspected. The remaining crowding is recorded below rather than characterized as solved.
- No migration, sign-in setting, secret value or participant record was changed by this review.
- The external dependency-advisory check was initially blocked, then completed after the user's explicit approval. It returned two development-tool advisories; see [results and applicability](dependency-review.md). No dependency versions were changed in this feature pass.

The fixes are deployed as Worker `88e89f09-329b-4be7-b532-2c8a81381ac7`. Exact public-content checks passed for every client asset and the homepage, along with the account gate and response headers. See [deployment status](deployment-status.md) for release and rollback details.

## What should be worked on next

### 1. Finish the canvas interface before adding more controls

Move secondary frame, expansion, highlight and earlier-record controls into accessible menus. Reduce repeated headings and the one-item mode strip. Give phones a compact context header and a deliberate full-canvas option; currently scrolling can leave the source toolbar above the visible area. Keep a minimum useful canvas height and make every composer action reachable by scrolling its panel.

Replace always-expanded inquiry/argument cards with compact markers and expand the selected conversation. Preserve independent Map/Inquiries/Arguments visibility. Test long names, many contributions, uneven source maps, keyboard focus and touch targets. Pair focus can leave other contributions outside the viewport by design; Fit both and Conversations must make them easy to find.

### 2. Define source changes and conversation history

The new conversation records retain their own wording history and an original target label, but do not pin complete source wording or show the earlier Argument system's source-review state. Decide how to display edited/deleted source nodes and edges, withdrawn targets, resolved counterpart requests, and revisions to definitions. Preserve old wording and attribution without granting access to later private map content. Implement this before treating a relationship as applying to an unchanging claim.

### 3. Develop structured arguments within the shared Comparison

Use the on-map conversation system as the current entry point. Design support, challenges, evidence, counterexamples and replies around the selected source or contribution. Decide how explicit reasoning connections should appear and how chains and threads differ. Keep author attribution and unilateral relationship recording; do not restore a required shared question or bilateral co-signing step.

The older `argument.mjs` model contains version-pinned nodes/edges and review logic worth reusing. Define a compatibility adapter or an additive migration before removing it. Never relabel an earlier judgment as a new endorsement or merge independently authored source nodes silently.

### 4. Reduce implementation coupling as each area changes

Separate conversation form state, canvas drawing and record lookup within `discussion-ui.mjs`; build indexed lookups for large conversations. Move remaining comparison-specific CSS out of accumulated overrides into a single owned section/module. Retain real browser coverage while replacing controller monkey-patching with explicit hooks. These are incremental refactors, not a framework rewrite.

### 5. Establish a durable release checkpoint and growth checks

The working tree still contains substantial earlier, uncommitted development. Review and commit the complete intended source set, then push and add CI with the application/account/build/browser checks. Exclude credentials, generated demos and database snapshots. Run the dependency advisory audit once authorized.

Before a larger beta, measure server-wide snapshot cost and the shared generation lock; the current design loads all records on the server before projecting one user's workspace. Add actor-scoped reads and appropriate pagination as needed. Add useful operational error reporting without logging private map bodies, sign-in codes or secrets. Evaluate abuse/rate-limit controls separately; this pass did not change the user's sign-in configuration.

## Still deferred

Node dragging, manual rearrangement, Bring together and the authored-versus-derived pod decision remain deferred by the owner.

## Reference guidance

The server-only access boundary was reviewed against the current [Supabase data security guidance](https://supabase.com/docs/guides/database/secure-data) and [API security guidance](https://supabase.com/docs/guides/api/securing-your-api). Secret/service-role access requires server-side authorization; enabling RLS alone does not validate that authorization. Worker review used [Cloudflare's current best practices](https://developers.cloudflare.com/workers/best-practices/workers-best-practices/).
