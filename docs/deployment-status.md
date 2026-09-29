# Deployment status

Updated September 29, 2026 (UTC).

## Current release

Display-name editing deployed September 29, 2026 at **18:03:22 UTC** (2:03 p.m. in New York). Release source: `6434e1e8425f6ed0fc9c401fc44a1de273925c52` on `redesign/node-interactions`, committed and pushed before hosted verification and deployment.

- Worker version **60**: `acdb8237-ab71-4bac-a4c4-7cedb56cb5ea`, serving **100%** of traffic. Deployment: `623e0756-5514-4de6-a4af-76ce6aaf09e2`.
- Account menu → **Change display name** updates the current participant's name on maps and contributions. Email and test accounts retain their existing login details and identity. The organizer's test-account list uses current profile names. See [display names](display-names.md).
- **57/57 local release checks passed**: `build/verification/2026-09-29T17-53-40-992Z-37192/summary.json`, using Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge. Coverage includes owner-only profile changes, invalid/stale writes, lost-acknowledgement replay, unchanged content, other-participant visibility, reload, test-account names, failed-save retry, cancellation and narrow layout. Two older unit fixtures were updated to provide the new account-name render hook. The narrow-screen capture passed visual review.
- **57/57 hosted checks passed** on the exact source in [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/36608705802), with verification complete at **18:01:50 UTC**. Runtime: Node 24.21.0, Python 3.13.15, Playwright 1.62.1 and Chromium. Evidence: `build/display-name-hosted-verification-evidence.json`.
- Public verification confirms all **57 client files** and the homepage match the tested checkout; configured sign-in, account denial, private-file denial and security headers passed. Worker SHA-256: `75b062e084efffc2308938dd8d2e359792e37583a7ba406556b8f7b849111b93`. Evidence: `build/display-name-release-evidence.json`.
- Existing runtime settings, eight encrypted bindings and the verified organizer binding were inherited unchanged. No schema migration, authentication-provider change or production account writes were needed. Auth metadata remains the bootstrap fallback; the application profile supplies the current name.

**Refresh Harmonious, open your account menu, and select Change display name.** Worker 59 is a compatible rollback and retains saved names, but lacks this setting. Subsequent release-note commits change documentation only.

## Preceding test-account release

Organizer-created test accounts deployed September 29, 2026 at **17:38:20 UTC** (1:38 p.m. in New York). Release source: `2732cadcfca151befbc4c14726a514d0234311da` on `redesign/node-interactions`, committed and pushed before hosted verification and deployment.

- Worker version **59**: `5274d6d1-a571-4f42-aba9-c6d50534d876`, serving **100%** of traffic. Deployment: `aef08359-3943-42e4-bbae-3c640643db46`.
- The organizer's account menu offers **Test accounts**: create a display name/username, copy a generated password, and replace forgotten passwords for test accounts. Testers select **Use a test account** and enter username/password without email or verification codes. Each account retains ordinary participant permissions and its own private starting map. Email-code accounts retain verification. See [test-account instructions](test-accounts.md).
- The owner identified their sign-in email; a read-only Auth query matched exactly one confirmed, non-test account. Its user ID was assigned to `TEST_ACCOUNT_ADMIN_ID` and verified in the uploaded version before deployment. Only this server-side ID grants creation/list/reset access; user-editable metadata cannot grant it. All eight existing encrypted bindings and runtime settings were inherited unchanged.
- **57/57 local release checks passed**: `build/verification/2026-09-29T17-25-29-969Z-103684/summary.json`, using Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge. Tests include owner boundaries, reserved identity/metadata checks, create/sign-in/reset, duplicate and invalid credentials, secure cookies, reload, private workspaces, email-sign-in regressions, credential clearing and narrow screens. Desktop and narrow captures passed visual review.
- **57/57 hosted checks passed** on the exact source in [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/36605059365), complete at **17:31:35 UTC**. Runtime: Node 24.21.0, Python 3.13.15, Playwright 1.62.1 and Chromium. Evidence: `build/test-accounts-hosted-verification-evidence.json`.
- Public verification confirms all **57 client files** and the homepage match the tested checkout, with sign-in configuration, account denial, private-file denial and security headers passing. Additional live checks confirm anonymous visitors cannot list/create via the authenticated administration routes, reset is denied while signed out, cross-origin test login is rejected, and missing credentials are validated. Evidence: `build/test-accounts-live-access.json` and `build/test-accounts-release-evidence.json`, verified at **17:39 UTC**. Worker SHA-256: `987812f046da7d5bb99868d887c22de3027472ad3bd174f74c53719b6cdc93aa`.
- No application database migration or production test-account writes were performed. Creation/login/reset flows were tested through real application routes with an isolated Auth fixture; live production verification did not create credentials. Security advisors retain only the existing service-only-table notices and [disabled leaked-password protection notice](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

**Refresh Harmonious, open your account menu, and select Test accounts.** Give each tester separate login details. Worker 58 preserves existing maps/discussions as a rollback, but lacks test-account access; restore Worker 59 to re-enable those logins. Release-note commits after the source revision change documentation only.

## Preceding node-dialogue release

Node-focused Argument dialogue deployed September 29, 2026 at **17:06:42 UTC** (1:06 p.m. in New York). Release source: `b58c121405f9fdd8a40d54706516a58b0d5fd089` on `redesign/node-interactions`, committed and pushed before hosted verification and deployment.

- Worker version **58**: `265d71cb-e036-43b3-85a8-7fe0d312a584`, serving **100%** of traffic. Deployment: `d7bdab2b-4551-4ca3-a9f5-4543fe2f6525`.
- In Argument, select an ordinary node and choose **Open argument canvas**. The original claim anchors a tree of disputes and replies, with explicit reply targets, straight connections, expanding space, branch collapse/expansion, full text, Find and a shared chronological log. **Back to comparison** restores the comparison camera and selection. Both accounts, portable authoring, browser navigation and draft protection are supported. This first canvas covers ordinary-node disputes; connection disputes retain their existing controls. No resolution workflow was added.
- New continuations use grammar metadata version **7** and the `argument-dialogue-v1` capability. The canonical target remains the original dispute; the immutable reply-to reference identifies the addressed contribution and revision. Earlier records retain their meaning and history without invented reply chains. Old tabs receive the existing draft-preserving refresh prompt when encountering new records.
- **55/55 local release checks passed**. Report: `build/verification/2026-09-29T17-00-45-435Z-98556/summary.json`. Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows. Coverage includes deep/branching exchanges, legacy projection, target/revision validation, withdrawal/history, memory and isolated PostgreSQL parity, two-account browser authoring, search, log parity, refresh/reload, draft protection, camera restoration, browser Back/Forward, portable authoring and narrow screens. Desktop and narrow captures passed visual review. An earlier run encountered a Windows sandbox build-access restriction; the complete run above passed with the required access.
- **55/55 hosted release checks passed** on the exact source in [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/36601796774), with all checks complete at **17:03:44 UTC**. Logs confirm Node 24.21.0, Python 3.13.15, Playwright 1.62.1 and Chromium. Evidence: `build/dialogue-release-hosted.json` and `build/dialogue-hosted-verification-evidence.json`.
- Additive migration `supabase/migrations/20260929163505_argument_dialogue.sql` was applied as remote migration **20260929170525**, named `argument_dialogue`. Production checks confirm the version-7 Reply catalog, invoker security, empty search paths and service-only function execution. The **113 records**, generation **153** and content fingerprint were unchanged. Security advisors have no new findings; the existing service-only-table informational notices and [disabled leaked-password protection notice](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remain unchanged. Evidence: `build/dialogue-database-verification.json`.
- Public verification confirms all **56 client files** and the homepage match the tested checkout, with configured sign-in, account denial, private-configuration denial and security headers passing. Evidence recorded at **17:07:11 UTC**: `build/public-dialogue-verification.json`. Worker SHA-256: `2e8970868bb43ea572f60d04c26762403b9c578454bf5ae43f672fbe64c34849`.
- All eight encrypted bindings and runtime settings were inherited and verified unchanged. No production account test writes were performed. Evidence: `build/dialogue-release-evidence.json`. Subsequent release-note commits change documentation only.

**Refresh both accounts, select a node in Argument, and choose Open argument canvas.** Worker 57 cannot read version-7 targeted replies: once they exist, any rollback must retain the version-7 reader, client capability handling and database validation. Existing deferrals and the technology stack remain unchanged.

## Preceding continuing-replies release

Continuing replies within Argument disputes deployed September 29, 2026 at **16:13:08 UTC** (12:13 p.m. in New York). Release source: `6b601254d03e8d529933f6b8143014cb5867b909` on `redesign/node-interactions`, committed and pushed before hosted verification and deployment.

- Worker version **57**: `57fed5ed-69e1-4ce1-a908-7d565d0775b9`, serving **100%** of traffic. Deployment: `ac616e3e-b169-4cdd-b977-e6b2e8720bee`.
- Both dispute participants can use **Reply** to continue the same exchange, with required message text and an optional node reference. Each message belongs directly to the original dispute and appears chronologically in its expanded log. There is no fixed exchange limit or forced turn-taking. The first recipient response retains its existing outcome choices; earlier responses remain intact. Authors can edit or withdraw their own messages with history preserved. No resolution, map change or comparison assessment is implied.
- New replies use grammar metadata version **6** and the `argument-replies-v1` client capability; historical versions 4 and 5 remain readable. Obsolete tabs receive the existing draft-preserving refresh prompt. Draft, retry and acknowledgement safeguards apply to replies. Timestamp ordering accounts for the latest observed message when participant clocks differ.
- **53/53 local release checks passed**. Report: `build/verification/2026-09-29T15-59-44-774Z-95092/summary.json`. Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows. Coverage includes 14 alternating replies and a same-person follow-up in memory and isolated PostgreSQL, two-account browser exchanges, chronological logs, refresh/reload, own edit/withdrawal, blank/invalid targets, optional references, draft parking and lost-acknowledgement retries. The browser capture passed visual review.
- **53/53 hosted release checks passed** on the exact source in [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/36594962111), with all checks complete at **16:07:53 UTC**. Logs confirm Node 24.21.0, Python 3.13.15, Playwright 1.62.1 and Chromium. Evidence: `build/replies-release-hosted.json` and `build/replies-hosted-verification-evidence.json`.
- Additive migration `supabase/migrations/20260929155132_argument_replies.sql` was applied as remote migration **20260929160859**, named `argument_replies`. Production query checks confirm the Reply catalog, invoker security, empty search paths and service-only function execution. The **111 records**, generation **151** and content fingerprint were unchanged. Security advisors have no new findings; the existing service-only-table informational notices and [disabled leaked-password protection notice](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remain unchanged. Evidence: `build/replies-database-verification.json`.
- Public verification confirms all **54 client files** and the homepage match the tested checkout, with configured sign-in, account denial, private-configuration denial and security headers passing. Evidence recorded at **16:13:52 UTC**: `build/public-replies-verification.json`. Worker SHA-256: `bffaabecd0fcc877c0aebe411512006eb3774974d8794152e97bb621f93c48fa`.
- All eight encrypted bindings and runtime settings were inherited and verified unchanged. No production account test writes were performed. Evidence: `build/replies-release-evidence.json`. Subsequent release-note commits change documentation only.

**Refresh both accounts, open a dispute and continue with Reply.** Worker 56 cannot read version-6 replies: once they exist, any rollback must retain the version-6 reader, client capability handling and database validation. Existing workspace storage safeguards and deferrals remain in place.

## Preceding expandable dispute-log release

Expandable node dispute logs deployed September 29, 2026 at **15:38:37 UTC** (11:38 a.m. in New York). Release source: `ef9a1522f4ed7d26284491d363f68433c75befa4` on `redesign/node-interactions`, committed and pushed before hosted verification and deployment.

- Worker version **56**: `ba5982bf-30c3-47fc-9ab8-e36d78cdf371`, serving **100%** of traffic. Deployment: `c38dd09a-67be-4f4b-99e6-324d2a44f08a`.
- Clicking a node in Argument shows its dispute log immediately. Collapsed entries show author, date, categories, comment preview, response count and the latest response. Expand for full dispute wording, references, earlier versions and complete responses. Respond is available to the intended recipient; existing edit/withdraw controls remain available through Manage. Withdrawn disputes have separate history.
- The log uses the selected node and current comparison. Account refresh preserves expanded entries, scroll and focused controls while updating responses. Compare/Inquiry, draft safeguards, source maps and stored interaction semantics are preserved; no resolution workflow was added.
- **53/53 local release checks passed**. Report: `build/verification/2026-09-29T15-28-37-446Z-104064/summary.json`. Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows. Two-account browser coverage verifies direct recipient response, collapsed previews, expanded full responses, background/manual refresh, edited responses, reload, scope, keyboard use and narrow screens. Desktop and narrow captures passed visual review.
- **53/53 hosted release checks passed** on the exact source in [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/36591039924), with all checks complete at **15:36:32 UTC**. Logs confirm Node 24.21.0, Python 3.13.15, Playwright 1.62.1 and Chromium. Evidence: `build/log-release-hosted.json` and `build/log-hosted-verification-evidence.json`.
- Public verification confirms all **54 client files** and the homepage match the tested checkout, with configured sign-in, account denial, private-configuration denial and security headers passing. Evidence recorded at **15:39:16 UTC**: `build/public-log-verification.json`. Worker SHA-256: `ae0a3ad5aaa4fb72db84faf470efda0780619f6e609ca1571b0b608adee013cd`.
- All eight encrypted bindings and runtime settings were inherited and verified unchanged. No database migration or production account test writes were required. Evidence: `build/log-release-evidence.json`. Subsequent release-note commits change documentation only.

**Refresh Harmonious, select Argument, and click a node with a recorded dispute.** Its latest response appears directly in the log; expand to read the full exchange. Worker 55 is a compatible rollback. Existing deferrals remain in place.

## Preceding full-description release

Full descriptions in the Dispute form deployed September 29, 2026 at **15:11:27 UTC** (11:11 a.m. in New York). Release source: `56a9f97275fb052cecea879208c459bfb352bb4d` on `redesign/node-interactions`, committed and pushed before hosted verification and deployment.

- Worker version **55**: `d053703c-1c24-4bcf-bee4-53398ae8d589`, serving **100%** of traffic. Deployment: `e53ef77b-f122-4f8b-b40d-8d53cd0104b7`.
- Opening or editing a node dispute shows the full node description below its title and above the four categories. Line breaks are preserved; longer descriptions scroll with the form. This uses the existing source snapshot and plain-text rendering.
- **53/53 local release checks passed**, including desktop and narrow-screen browser checks and visual review. Report: `build/verification/2026-09-29T15-00-25-931Z-50464/summary.json`. Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows.
- **53/53 hosted release checks passed** on the exact pushed source in [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/36587484585), with all checks complete at **15:09:20 UTC**. Logs confirm Node 24.21.0, Python 3.13.15, Playwright 1.62.1 and Chromium. Evidence: `build/description-release-hosted.json` and `build/description-hosted-verification-evidence.json`.
- Public verification confirms all **54 client files** and the homepage match the tested checkout; configured sign-in, anonymous account denial, private-configuration denial and security headers passed. Evidence recorded at **15:12:14 UTC**: `build/public-description-verification.json`. Worker SHA-256: `5fb58de3d02b9cb2175fbced8cd55cf045786af2ed78ea9d182c3b3a40156970`.
- All eight encrypted bindings, compatibility date `2026-09-08`, empty compatibility flags and standard usage model were inherited and verified unchanged. No database migration, production account test writes, authentication changes or dependency updates were required. Overall evidence: `build/description-release-evidence.json`. Subsequent release-note commits change documentation only.

**Refresh Harmonious before testing.** Check the full description in the [Argument checklist](user-testing-checklist.md). Worker 54 is a compatible rollback; older rollbacks must retain the version-5 reader and validation described below. Existing deferrals remain in place.

## Preceding four-category Argument release

Four-category Argument deployed September 29, 2026 at **14:43:29 UTC** (10:43 a.m. in New York). Release source: `c62161b5c46856c5d9d1039a41289cc4349b3b6b` on `redesign/node-interactions`, committed and pushed before hosted verification and deployment.

- Worker version **54**: `8f00a6d4-d9b8-4dba-9985-63781209893e`, serving **100%** of traffic. Deployment: `46ca779d-3fd4-43a0-85c7-1c13e83ef862`.
- The [Argument update](argument-four-categories-plan.md) offers exactly **Factual basis**, **Reasoning**, **Consequences** and **Feasibility** for new disputes on eligible nodes and typed connections. Select one or more; comments and a single reference remain optional. The action label and existing recipient responses are retained. Argument resolution remains outside scope.
- New disputes use grammar metadata version 5. Version-4 grounds retain their original labels and history. Editing an earlier dispute requires explicit current-category selection, keeps earlier Other wording visible in the comment draft and preserves Earlier versions. New arguments have no additional Other category or inferred Signals. The stack, source maps, comparison assessments, counterpart links and canvas layout remain unchanged.
- **53/53 local release checks passed**, including ten browser suites, isolated PostgreSQL validation and migration checks, portable authoring, production build and complete assets. Report: `build/verification/2026-09-29T14-32-31-252Z-105308/summary.json`. Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows.
- **53/53 hosted release checks passed** on the exact pushed source in [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/36583982914), with all checks complete at **14:40:38 UTC** and the job successful at **14:40:42 UTC**. Logs confirm Node 24.21.0, Python 3.13.15, Playwright 1.62.1 and Chromium. Evidence: `build/argument-release-hosted.json` and `build/argument-hosted-verification-evidence.json`.
- Coverage includes every nonempty category combination, invalid/duplicate choices, JavaScript/SQL parity, old dispute responses and withdrawal, explicit edit conversion with immutable history, obsolete-tab refresh handling, source/reference privacy and freshness, draft/retry safeguards, search/details, desktop/narrow screens and portable files. Desktop and narrow form captures passed visual review.
- Additive migration `supabase/migrations/20260929142645_argument_categories.sql` was applied as remote migration **20260929144218**, named `argument_categories`. Production query checks confirm all four new categories and the historical catalog. Both affected functions retain invoker security, an empty search path and service-only execution. The **107 records**, generation **147** and content fingerprint were unchanged. Security advisors have no new findings; existing service-only-table informational notices and the [disabled leaked-password protection notice](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remain unchanged. Evidence: `build/argument-database-verification.json`.
- Public verification confirms all **54 client files** and the homepage match the tested checkout; configured sign-in, anonymous account denial, private-configuration denial and security headers passed. Timestamp and evidence: `build/public-argument-verification.json`. Worker SHA-256: `032a596877cc98c4585e729d9963333a04de302387ff846fc36ae02370764bce`.
- All eight encrypted bindings, compatibility date `2026-09-08`, empty compatibility flags and standard usage model were inherited and verified unchanged. No production account test writes, authentication changes or dependency updates were required. Automatic push/PR checks and deployment remain disabled. Overall evidence: `build/argument-release-evidence.json`. Subsequent release-note commits change documentation only.

**Reload both PCs before testing.** Start with **Four-category Argument** in [the checklist](user-testing-checklist.md). Older tabs receive the existing draft-preserving refresh-required response when encountering new-format arguments or trying to submit an obsolete dispute form. Worker 53 cannot read version-5 disputes: once they exist, any rollback must retain the version-aware reader, client capability handling and database validation. Existing deferrals remain in place.

## Preceding agreement overview release

Joined agreement cards and comparison overview deployed September 29, 2026 at **13:54:32 UTC** (9:54 a.m. in New York). Release source: `fc9f77931fbe1e92fde8179c2c96f236b6a7e5ea` on `redesign/node-interactions`, committed and pushed before hosted verification and deployment.

- Worker version **53**: `30adaf8c-674a-4613-8477-9bf7c617c2a7`, serving **100%** of traffic. Deployment: `b3a606be-48d5-4cb2-bc8e-502a43a5df06`.
- The [joined-card and overview update](agreement-overview-plan.md) visually joins mutually agreeing counterparts while preserving both original wordings, owners, confidence values, controls and source connections. Both disagree, mixed positions, both no position, awaiting assessment and needs-review states remain distinct.
- Overview begins below 45% zoom and returns to detail at 55%, preserving node coordinates. Colored pair silhouettes remain visible at extreme zoom; larger controls avoid other nodes and markers. Crowded pairs remain individually available under **pairs need closer zoom**, which deliberately centers the chosen pair at a readable scale. Compare, Inquiry, Argument and portable exports share this presentation.
- All **53 local checks passed**, including ten browser suites. The initial run passed checks 1–51; Windows sandbox directory access blocked the production builder, so checks 52–53 were rerun successfully with the required filesystem access. The counterpart browser suite passed again after its test-only visible-control correction. Original report: `build/verification/2026-09-29T13-37-36-528Z-103552/summary.json`; combined evidence: `build/agreement-local-verification-evidence.json`. Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows.
- **53/53 hosted release checks passed** on the exact pushed release source in [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/36577971160), with all checks complete at **13:53:06 UTC** and the job successful at **13:53:09 UTC**. Logs confirm Node 24.21.0, Python 3.13.15, Playwright 1.62.1 and Chromium. Evidence: `build/agreement-release-hosted.json` and `build/agreement-hosted-verification-evidence.json`.
- The first hosted attempt found an older test clicking the underlying full node at overview zoom. The test now selects the visible original-node overview control; the application was unchanged by that correction. Final hosted verification passed in full.
- Coverage includes all assessment combinations, reversed sides, withdrawal and stale-source precedence, privacy, unlinking, legacy multiple links, source immutability, differing wording/confidence, stable geometry, collapse/filtering, mode consistency, keyboard focus, narrow touch targets, dense comparisons and portable files. Desktop, low-zoom, dense and touch captures were visually reviewed.
- Public verification at **13:55:05 UTC** confirms all **54 client files** and the homepage match the tested checkout, with configured sign-in, anonymous account denial, private-configuration denial and security headers passing. Report: `build/public-agreement-verification.json`. Worker SHA-256: `6d8167e8f2ffb9f21a59b95c50cdbd6609cd2aa03f5cd325da6127f666c419ed`.
- All eight encrypted bindings, compatibility date `2026-09-08`, empty compatibility flags and standard usage model were inherited and verified unchanged. No database migration, production account test writes, authentication change or dependency update were required. Automatic push/PR checks and deployment remain disabled. Release evidence: `build/agreement-release-evidence.json`. Subsequent release-note commits change documentation only.

**Reload both PCs before testing.** Start with **Joined agreement cards and overview** in [the checklist](user-testing-checklist.md). Worker 52 is the preceding compatible release. The receipt-aware reader and database constraints from Worker 52 must be retained in any older rollback. Automatic merging of source records and the separate Aligned / In tension proposal remain outside this visual update; other [deferrals](next-work-plan.md#deferred-work) remain unchanged.

## Preceding counterpart controls and assessments release

Counterpart controls and visible assessments deployed September 29, 2026 at **01:32:19 UTC** (September 28 at 9:32 p.m. in New York). Application source: `a70186087b180e77cd9c9de3028924ca490650a8` on `redesign/node-interactions`, committed and pushed before hosted verification and deployment.

- Worker version **52**: `6597c36a-5d1d-4616-a892-e0afad7d31ac`, serving **100%** of traffic. Deployment: `1dab4df7-29a2-41ad-813c-bb4b0aadaeb3`.
- The [counterpart controls and assessment update](counterpart-controls-and-assessments.md) restricts new links to free ordinary nodes in the same frame, with at most one counterpart per node in each comparison. **Unlink counterpart** is available to either participant and preserves attributed history and personal assessments. Earlier links remain readable; creation is offered only when answering an explicit request.
- Ordinary menus omit redundant view/link-another/read-source controls. **Agree** replaces the visible Endorse label. Named personal Agree, Disagree and No position badges appear on cards, with Not assessed kept distinct. Matching current reciprocal assessments on a one-to-one pair show **Both agree / Both disagree**; asymmetric, stale, missing, withdrawn and No position assessments have no mutual verdict.
- Blank-canvas clicks close transient windows while panning, touch gestures and unfinished-form safeguards retain their behavior. Full-size ghosts, expanded spacing and the text-selection fix remain in place.
- **53/53 local release checks passed**, including ten browser suites, model/account and PostgreSQL boundary checks, standalone export, production build and complete asset checks. Report: `build/verification/2026-09-29T01-21-11-028Z-101032/summary.json`. Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows.
- **53/53 hosted release checks passed** on the exact pushed source in [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/36507815433), with all checks complete at **01:29:04 UTC** and the job successful at **01:29:08 UTC**. Logs confirm Node 24.21.0, Python 3.13.15, Playwright 1.62.1 and Chromium. Evidence: `build/counterpart-release-hosted.json` and `build/counterpart-hosted-verification-evidence.json`.
- Coverage includes both participants, same-frame filtering, competing saves, unlink/relink and lost acknowledgments, immutable history, privacy changes without resurrecting an older opinion, withdrawal precedence, stale-source review, keyboard/focus and draft protection, mode consistency, desktop/narrow card geometry and portable export. Independent reviews and visual inspection passed.
- The additive migration `supabase/migrations/20260929005321_counterpart_integrity.sql` was applied as remote migration **20260929013043**, named `counterpart_integrity`. Read-only verification confirms all five new functions use invoker security with an empty search path and service-only execution; both constraints, receipt ordering and table RLS are present. The 104 existing records, generation 144 and content fingerprint were unchanged. Security advisors have no new findings; the existing service-only-table informational notices and [disabled leaked-password protection notice](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) remain unchanged.
- Public verification at **01:33:03 UTC** confirms all **54 client files** and the homepage match the tested checkout, with configured sign-in, anonymous account denial, private-configuration denial and security headers passing. Report: `build/public-counterpart-verification.json`. Worker SHA-256: `0a6526e91399a126b1d02083a1f6fc0890b593e0dbeb2c86498515894797e7c3`.
- All eight encrypted bindings, compatibility date `2026-09-08`, empty compatibility flags and standard usage model were inherited and verified unchanged. No production account test writes, authentication change or dependency update were required. Automatic push/PR checks and deployment remain disabled. Release evidence: `build/counterpart-release-evidence.json`. Subsequent release-note commits change documentation only.

**Reload both PCs before testing.** Start with **Counterpart controls and assessments** in [the checklist](user-testing-checklist.md). Older tabs encountering an unlink receipt receive the existing refresh-required response while preserving their draft. Worker 51 predates unlink receipts: after receipts are written, any rollback must retain the receipt-aware reader and database constraints rather than simply restoring Worker 51. The [deferral list](next-work-plan.md#deferred-work) is unchanged; separate Aligned / In tension design remains unimplemented.

## Preceding canvas dragging release

Canvas dragging and text-selection fix deployed September 29, 2026 at **00:34:02 UTC** (September 28 at 8:34 p.m. in New York). Application source: `d525242adcc756069c51b1be4ecfa81bece06cbd` on `redesign/node-interactions`, committed and pushed before hosted verification and deployment.

- Worker version **51**: `d29cd1f9-3431-4e7d-aa6c-93e3dd8f1610`, serving **100%** of traffic. Deployment: `0232b2fd-e0aa-4876-9bb1-10481dc42adb`.
- The [canvas-panning fix](canvas-panning-fix.md) prevents accepted blank-canvas drags from starting browser text selection or native text dragging. The reproduced selected-hint case previously moved only 18 pixels of a 450-pixel drag before the browser cancelled panning. It now follows the full gesture in Map/Create, source browsing, Inquiry, Compare and Argument.
- Drag state resets on release, cancellation, capture loss, window blur, a hidden document and a mouse move without the primary button held. The canvas retains keyboard focus. Text fields, details, node/counterpart/reasoning cards and controls keep their own interactions; selection suppression lasts only for an active canvas pan.
- **49/49 local release checks passed**, including nine browser suites, database/account checks, standalone export, production build and complete asset checks. Report: `build/verification/2026-09-29T00-24-39-633Z-97312/summary.json`. Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows.
- **49/49 hosted release checks passed** on the exact pushed source in [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/36503287256), completed at **00:32:03 UTC**. Its log confirms the native-mouse regression and all 49 checks with Node 24.21.0, Python 3.13.15, Playwright 1.62.1 and Chromium. Evidence: `build/drag-release-hosted.json` and `build/drag-hosted-verification-evidence.json`.
- New browser coverage includes existing text ranges, genuine drags over selected hints, full camera displacement outside the surface, release/repeated drags, interrupted capture, textarea selection and saved edits, keyboard navigation, zoom controls, touch pinch and portable-file panning. Independent review found no capture-lifecycle or focus blockers.
- Public verification at **00:34:54 UTC** confirms all **54 client files** and the homepage match the tested checkout, with configured sign-in, anonymous account denial, private-configuration denial and security headers passing. Report: `build/public-drag-verification.json`. Worker SHA-256: `1cdba76bb16bcb5561fd838f0efe084e3825257cb361c8d2750a62825b6193bc`.
- All eight encrypted bindings, compatibility date `2026-09-08`, empty compatibility flags and standard usage model were inherited and verified unchanged. No data migration, production account test write, authentication change or dependency update was required. Automatic push/PR checks and deployment remain disabled. Release evidence: `build/drag-release-evidence.json`. Subsequent release-note commits change documentation only.

**Reload both PCs before testing.** Start with **Canvas dragging** in [the checklist](user-testing-checklist.md). Worker 50 is the preceding compatible release. The full-size ghosts and expanded layout remain in place; the [deferral list](next-work-plan.md#deferred-work) is unchanged.

## Preceding full-size counterparts and expanded spacing release

Full-size counterpart ghosts and expanded comparison space deployed September 28, 2026 at **23:57:23 UTC** (7:57 p.m. in New York). Application and verification source: `7495a711fe92c875fb3e3580405a3ed1b0259fec` on `redesign/node-interactions`, committed and pushed before hosted verification and deployment.

- Worker version **50**: `8527c720-0abe-4a83-aa97-ee7116ac5bba`, serving **100%** of traffic. Deployment: `da0d083c-adf6-45cb-b122-9f04cb25dc87`.
- The [space and line follow-up](comparison-space-and-lines.md) is implemented. Ghosts match real cards at **252 × 166** with a **16-unit** pair gap. Status, opposite owner, request history and permitted actions remain available across shared modes.
- The radial comparison layout expands to make room for straight parent connections, using actual real-card and ghost bounds. Clear lines stay straight even when they cross another line. Adjacent recorded counterparts use a short straight gap connection with inspectable meanings, authors and attached discussion. Exceptional obstructed extra connections retain safe detours; arbitrary cross-frame links are not guaranteed straight.
- Expansion, collapse and frame filtering retain zoom and a visible anchor. The canvas can extend beyond the screen; pan at a readable zoom or deliberately use **Fit** for an overview. Source-map/Create layout, source records, pair eligibility and existing permissions are preserved.
- **48/48 local release checks passed**, including eight browser suites, account/database checks, standalone export, production build and complete asset checks. Report: `build/verification/2026-09-28T23-48-48-101Z-91384/summary.json`. Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows. Final portable-browser checks and desktop/narrow captures passed review.
- **48/48 hosted release checks passed** on the exact pushed source in [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/36500236951), completed at **23:55:17 UTC**. Its job log confirms all 48 checks using Node 24.21.0, Python 3.13.15, Playwright 1.62.1 and Chromium. Evidence: `build/space-release-hosted.json` and `build/space-hosted-verification-evidence.json`.
- The first hosted attempt exposed a test that counted unrelated valid links in a reused comparison. A deterministic mixed-pair fixture now scopes missing-endpoint assertions correctly and checks that unrelated links and permitted history survive. The application was unchanged by this test correction; the final complete local and hosted runs both passed.
- Public verification at **23:58:27 UTC** confirms all **54 client files** and the homepage match the tested checkout, with configured sign-in, anonymous account denial, private-configuration denial and security headers passing. Report: `build/public-space-verification.json`. Worker SHA-256: `be57d7b3a7dc1dbc17ecb1bb65f13cc02849425477d143e5f9ae6172ce192f9b`.
- All eight encrypted bindings, compatibility date `2026-09-08`, empty compatibility flags and standard usage model were inherited and verified unchanged. No database migration, production account test write, authentication change or dependency update was required. Automatic push/PR checks and automatic deployment remain disabled. Release evidence: `build/space-release-evidence.json`.
- Regression coverage includes the screenshot 12/13 cases, unequal maps, a 98-node forest, a 100-level chain, 40-child fan-out, both owners, linking/withdrawal, request states, keyboard return, camera retention, shared modes, cold reload and standalone export. Subsequent release-note commits change documentation only.

**Reload both PCs before testing.** Start with **Full-size ghosts and space for straight connections** in [the checklist](user-testing-checklist.md). Existing comparisons adopt the display without rewriting source maps or saved links. Worker 49 is the preceding compatible release. Pair-specific **Aligned / In tension** remains the next separate design discussion; the [deferral list](next-work-plan.md#deferred-work) is unchanged.

## Preceding independent comparison nodes release

Independent comparison nodes, compact counterpart controls, and balanced spacing deployed September 28, 2026 at **23:05:11 UTC** (7:05 p.m. in New York). Application source: `b419d39ab217cda49fdda4f37c9d0c97ed18c95b` on `redesign/node-interactions`, committed and pushed before hosted verification and deployment.

- Worker version **49**: `c794158a-267b-487f-93f7-e0700357ae20`, serving **100%** of traffic. Deployment: `fbcfe3dc-fb1c-4f8a-9ebd-754bc4406d19`.
- The [positioning plan](comparison-positioning-plan.md) is implemented. Ordinary nodes no longer become visual pairs through order, matching wording, or copied IDs. Every solo ordinary node has a compact ghost/status control; eligible saved pairs remain adjacent. Requested, replied, closed, multiple, hidden, cross-frame, and unavailable counterparts retain accurate status and permitted history. Shared modes use identical source geometry; counterpart authoring stays in Compare.
- Spacing uses occupied groups and actual card/control dimensions. The five-child fixture improved from **1363 × 1142** to **874 × 897** canvas units, including ghosts, close to Create's **869 × 917**. Cards, compact controls, routing, animation and Fit share the same geometry. Linking/withdrawal keeps the initiating node's screen position and zoom; repeated changes leave no unused slots. Dense maps can still have crossings, and broadly optimizing cross-depth placement remains deferred.
- **48/48 local release checks passed**, including eight browser suites, account/database checks, standalone export, production build and complete asset checks. Report: `build/verification/2026-09-28T22-54-47-000Z-36428/summary.json`. Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows. The final portable-browser check passed; desktop and narrow screenshots were inspected at Fit and readable working zooms.
- **48/48 hosted release checks passed** on the exact pushed application commit in [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/36495506271), completed at **23:02:00 UTC**. Its job log confirms all 48 checks using Node 24.21.0, Python 3.13.15, Playwright 1.62.1 and Chromium. Evidence: `build/positioning-release-hosted.json` and `build/positioning-hosted-verification-evidence.json`.
- Public verification recorded at **23:06:02 UTC** confirms all **54 client files** and the homepage match the tested checkout, with configured sign-in, anonymous account denial, private-configuration denial and security headers passing. Report: `build/public-positioning-verification.json`. Worker SHA-256: `da6ed240cee484b55a4d61aff3b181237dc4b99c452f81c85f7b6f9af44b7fbd`.
- All eight encrypted bindings, compatibility date `2026-09-08`, empty compatibility flags and standard usage model were inherited and verified unchanged. No database migration, production account test write, authentication change or dependency update was required. Automatic push/PR checks and automatic deployment remain disabled. Release evidence: `build/positioning-release-evidence.json`.
- Independent review and regressions cover both participants and reversed source sides, withdrawn/missing/hidden links, request histories, exact source preservation, source-change validation, atomic retry, keyboard focus, parked drafts, 100 filter/expansion patterns, conflicting pair sets, and dense/deep graphs. Subsequent release-note commits change documentation only.

**Reload both PCs before testing.** Start with **Independent nodes, ghosts, and comparison spacing** in [the checklist](user-testing-checklist.md). Existing comparisons adopt the new display without rewriting source maps or saved links. Worker 48 is the preceding compatible release. Pair-specific **Aligned / In tension** remains the next separate design discussion; the [deferral list](next-work-plan.md#deferred-work) is unchanged.

## Preceding comparison connections and counterpart controls release

Comparison connections and counterpart controls deployed September 28, 2026 at **22:14:38 UTC** (6:14 p.m. in New York). Application source: `27269a60d04f5f8f84f59cd1fb445b626978cfaf` on `redesign/node-interactions`, committed and pushed before hosted verification and deployment.

- Worker version **48**: `1f360dd4-48a6-4dc1-b53d-86e022e099ec`, serving **100%** of traffic. Deployment: `85c29e75-fe8d-4800-9535-c96577eac276`.
- The [comparison clarity plan](comparison-clarity-plan.md) is implemented: ordinary selection preserves node positions and camera; counterpart linking opens a searchable, explicit chooser from either map; shared comparisons omit decorative frame spines; sibling routes use distinct ports and avoid misleading shared segments. Source lines, arrow direction, endpoint highlights and inspection share the same geometry across views. **View options → Connection key** explains the displayed connections.
- **48/48 local release checks passed**, including eight browser suites, account/database checks, standalone export, production build and complete asset checks. Report: `build/verification/2026-09-28T22-03-45-484Z-88496/summary.json`. Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows. The portable-browser comparison smoke check passed, and desktop/narrow screenshots were inspected.
- **48/48 hosted release checks passed** on the exact pushed application commit in [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/36490788740), completed at **22:12:46 UTC**. Its job log confirms all 48 checks using Node 24.21.0, Python 3.13.15, Playwright 1.62.1 and Chromium. Evidence: `build/clarity-release-hosted.json` and `build/clarity-hosted-verification-evidence.json`.
- Public verification at **22:15:13 UTC** confirms all **54 client files** and the homepage match the tested checkout, with configured sign-in, anonymous account denial, private-configuration denial and security headers passing. Report: `build/public-clarity-verification.json`. Worker SHA-256: `6448aab2fe4722c7948aabaa1c15b32889bfc92f280691295ae5227f02920e75`.
- All eight encrypted bindings, compatibility date `2026-09-08` and empty compatibility flags were inherited and verified unchanged. No database migration, production account test write, authentication change or dependency update was required. Automatic push/PR checks and automatic deployment remain disabled.
- Independent review and browser regressions cover both participants, stable five-child selection, explicit/cancelled requests, multiple links, stale wording and ancestor paths, lost-acknowledgment retries, exact connection endpoints, semantic arrow direction, map emphasis, collapsed frames and deep/dense maps. Subsequent release-note commits change documentation only.

**Reload both PCs before testing.** Start with **Comparison connections and counterparts** in [the checklist](user-testing-checklist.md). Worker 47 is the preceding compatible release. Pair-specific **Aligned / In tension** assessments remain a separate design decision; the [deferral list](next-work-plan.md#deferred-work) is unchanged.

## Preceding node-face editing and map-copy release

Node-face editing, confidence sliders, and map copying deployed September 28, 2026 at **21:11:22 UTC** (5:11 p.m. in New York). Application source: `d350313ac2d9fe7444a48359899a85ce7637abc0` on `redesign/node-interactions`, committed and pushed before hosted verification and deployment.

- Worker version **47**: `688aa821-4287-499d-b8c2-dec09731cd90`, serving **100%** of traffic. Deployment: `d62c5a36-40d0-47f4-b2e7-a2486d9d8b11`.
- The [accepted follow-up](node-face-editing.md) adds immediate unsaved child previews with title focus, editing on the expanded node face with expandable Details, confidence sliders with exact numeric entry, and a direct Library Copy map action. Whole copies retain authored confidence and handle empty maps atomically; another author's confidence remains unassessed.
- **47/47 local release checks passed** on the application changes, including seven browser suites, account/database checks, standalone export, production build and complete asset checks. Report: `build/verification/2026-09-28T21-03-56-493Z-99272/summary.json`. Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows. Final focused browser checks also passed after adding coverage for noninteractive preview edges and mobile cancellation restoring the parent's camera. The portable Reset → Save/download check passed.
- **47/47 hosted release checks passed** on the exact pushed application commit in [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/36483892218), completed at **21:09:07 UTC**. Its job log confirms all 47 checks using Node 24.21.0, Python 3.13.15, Playwright 1.62.1 and Chromium. Evidence: `build/face-release-hosted.json`.
- Public verification at **21:12:24 UTC** confirms all **54 client files** and the homepage match the tested checkout, with configured sign-in, anonymous account denial, private-configuration denial and security headers passing. Report: `build/public-face-verification.json`. Worker SHA-256: `8f96037e48cf87d4677ad4e41a58d6c69e94c9a522ad664dda5e3696d844dfc0`.
- All eight encrypted bindings, compatibility date `2026-09-08` and empty compatibility flags were inherited and verified unchanged. No database migration, production account test write, authentication change or dependency update was required. Automatic push/PR checks and automatic deployment remain disabled.
- Independent review covered preview cleanup, camera/focus restoration, and draft isolation. Browser checks confirm autosave retains the mounted form, caret and expanded Details; confidence ownership/null semantics; copy independence, privacy and reload; and narrow-screen controls. Desktop and mobile screenshots were inspected. Subsequent release-note commits change documentation only.

**Reload both PCs before testing.** Start with **Editing on the node, confidence scale, and map copying** in [the checklist](user-testing-checklist.md). Worker 46 is the preceding compatible release. The [deferral list](next-work-plan.md#deferred-work) is unchanged.

## Preceding map setup and node-menu release

Map setup, frame colors, and node-menu cleanup deployed September 28, 2026 at **20:19:49 UTC** (4:19 p.m. in New York). Application source: `626ad697731b2c88da2188a5027160a6b500d3e0` on `redesign/node-interactions`, committed and pushed before hosted verification and deployment.

- Worker version **46**: `936d34e7-942c-4d8c-8766-d88c0296118c`, serving **100%** of traffic. Deployment: `ca5041c1-cf4c-45c3-b302-acacac72b439`.
- The [implemented plan](node-menu-cleanup-plan.md) repairs comparison source selection, centralizes SQ red / TA blue / GS green, separates node-menu action groups, introduces explicit child drafts with an optional reason relationship, and gives eligible nodes persistent nullable Confidence. Definitions and connections are reachable through inspection; shared modes retain their distinct actions and owner permissions.
- **46/46 local release checks passed** on the final application changes, including all six browser suites, account/database checks, standalone export, production build and complete asset checks. Report: `build/verification/2026-09-28T20-12-45-780Z-88264/summary.json`. Runtime: Node 24.19.0, Python 3.12.14, Playwright 1.62.1 and Edge on Windows.
- **46/46 hosted release checks passed** on the exact pushed application commit in [Release checks](https://github.com/tlrdevere/harmonious/actions/runs/36477959624), completed at **20:18:03 UTC**. The clean hosted run used Node 24.21.0, Python 3.13.15, Playwright 1.62.1 and Chromium; its job log confirms all 46 checks. Evidence: `build/menu-release-hosted.json`.
- Public verification at **20:20:49 UTC** confirms all **53 client files** and the homepage match the tested checkout, with configured sign-in, anonymous account denial, private-configuration denial and security headers passing. Report: `build/public-menu-verification.json`. Worker SHA-256: `32303f07211fb960a9a43b7a2779caa56bc31a690f19aae65e73af6d1e341625`.
- All eight encrypted bindings, compatibility date `2026-09-08` and empty compatibility flags were inherited and verified unchanged. No database migration, production account test write, authentication change or dependency update was required. Automatic push/PR checks and automatic deployment remain disabled.
- Independent review and browser regressions cover discarded child drafts, delayed autosave, read/edit separation, confidence and disclosure focus, and portable Reset followed by Save. Desktop and narrow screenshots were inspected. Release-note commits after the application commit change documentation only.

**Reload both PCs before testing.** Start with **Map setup, frame colors, and node menus** in [the checklist](user-testing-checklist.md). Worker 45 is the preceding compatible release. The [deferral list](next-work-plan.md#deferred-work) is unchanged.

## Preceding code and view-consistency release

Code and view-consistency fixes deployed September 27, 2026 at **02:45:36 UTC** (September 26 at 10:45 p.m. in New York). Application source: `b3f9a2a2d469f9467e49f1bd0c85245bf17174e7` on `redesign/node-interactions`, committed and pushed before hosted verification and deployment.

- Worker version **45**: `aa9fc78b-c1cb-4287-a9b7-79babe954060`, serving **100%** of traffic. Deployment: `da7868c2-b204-4544-8a73-9432d5550b03`.
- The [code review](code-review-2026-09-27.md) fixes omitted source-map connections, interaction edits after source classification changes, imported confidence attribution, deleted-node control cleanup and legacy-node confidence eligibility. Source browsing uses grouped, directed, read-only connection details; existing shared-mode actions remain distinct.
- **46/46 local release checks passed** on the application changes, including all six browser suites, account/database tests, standalone export, production build and asset checks. Report: `build/verification/2026-09-27T01-44-43-379Z-78148/summary.json`.
- **46/46 hosted release checks passed** on the exact pushed application commit in [Release checks run 2](https://github.com/tlrdevere/harmonious/actions/runs/36289166920), completed at **02:41:45 UTC**. The clean Ubuntu 24.04 run used Node 24.21.0, Python 3.13.15, Playwright 1.62.1 and Chromium. Its log confirms all 46 checks; local evidence is saved in `build/review-release-hosted.json` and `build/review-release-evidence.json`.
- Public verification at **02:46:26 UTC** confirms all **52 client files** and the homepage exactly match the tested checkout. Configured sign-in, anonymous account denial, private-configuration denial and security headers pass. Report: `build/public-review-verification.json`. Worker SHA-256: `694dcca9524d9856fe616a6917264922fe212494eea051e078af84f0bc154be0`.
- All eight encrypted bindings, compatibility date `2026-09-08` and empty compatibility flags were preserved and checked after deployment. No database migration, live account test write, authentication change, dependency update or registry audit was needed. Automatic push/PR checks and automatic deployment remain disabled.
- Subsequent release-note commits change documentation only and are separate from the exact tested and deployed application commit above. The protected baseline and `main` were not changed by this release.

**Reload both PCs before testing.** Start with **Code review and view consistency** in [the checklist](user-testing-checklist.md). Worker 44 is the preceding compatible release. The three newly deferred suggestions and all earlier deferrals remain in [the next-work plan](next-work-plan.md#deferred-work).

## Preceding connection-drawing release

Connection drawing and inspection deployed September 25, 2026 at **20:36:30 UTC** (4:36 p.m. in New York). Application source: `5f8a6f78846b57ecf300207a161a30859c375a6f` on `redesign/node-interactions`.

- Worker version **44**: `b6ffecd8-8ec3-4e43-9af9-5bed646d8973`, serving **100%** of traffic. Deployment: `24e72e1f-190b-46cd-afe5-5947d1e1c3e4`.
- The misleading **2 connections · Collapsed branches** line is replaced by compact branch badges. Their counts group distinct real node pairs, with attributed judgments, counterpart meanings, earlier comparisons and withdrawn history retained in detail. **Show connected nodes** reveals both actual endpoints, retains zoom/unrelated folds and respects drafts. Filtered and unavailable sources do not become fictitious ancestor edges.
- Map/Create, Inquiry, Compare and Argument share direct-if-clear, rounded-if-obstructed routes. Radial node positions are retained. Exact pairs have one visible edge with their saved meanings/directions inspectable; source routes stay stable across mode changes. Bounded route calculations and completed-geometry reuse avoid recalculation during Map/Create pan/zoom.
- Map/Create connection selection opens a compact on-map menu, with owner Edit/Remove actions and the existing optional edit panel. Additional connections default to All visible in View options. Hiding them never substitutes an apparently different parent line. Keyboard focus, fold cleanup, reveal centering and single draft-discard confirmation are covered.
- **46/46 release checks passed**, including six browser suites, account/database tests, standalone export, production build and complete module graph. Report: `build/verification/2026-09-25T20-33-53-484Z-66488/summary.json`. New regression coverage includes asymmetric/both-side collapse, exact-pair counts, historical follow-ups, frame-filter reveal, unchanged stored data, counterpart suppression, source-route reuse, card avoidance, direction, Map/Create editing/removal and narrow screens. Desktop/mobile screenshots and the [computed routing preview](design/connection-routing.html) were visually inspected.
- Public verification at **20:36:47 UTC** confirms all **51 client files** and the homepage match the tested checkout, with configured sign-in, anonymous account denial, private-configuration denial and security headers intact. Report: `build/public-connection-verification.json`. Worker SHA-256: `68133e87f6545d1ba1d0b538bd8a4afb32c210ae7b40008736fc400331af55a1`.
- All eight encrypted bindings, compatibility date `2026-09-08`, and empty compatibility flags were preserved. No database migration, live account test write, authentication change, dependency update or registry audit occurred. The two increments in [the plan](connection-drawing-plan.md) were finished and verified together for one release. Source and release notes were checkpointed locally at publication; subsequent GitHub synchronization is recorded below.

**Reload both PCs before testing.** Start with **Connection drawing and inspection** in [the checklist](user-testing-checklist.md). The preceding v4-compatible release is Worker 43/source `885280d`; the pre-redesign stable tag remains unchanged. Owner usability acceptance remains outstanding.

Cross-depth counterpart placement refinement and Compass design/implementation (including axes and endpoint wording) are explicitly deferred by the owner; see the [current deferral list](next-work-plan.md#deferred-work). The existing radial layout remains in place, and the Compass preview remains illustrative.

## GitHub synchronization and hosted verification

Completed September 26, 2026 at **02:10:34 UTC** (September 25 at 10:10 p.m. in New York).

- The existing `redesign/node-interactions` history was pushed to GitHub and its exact commit `e42f83ab9fb97b8484bda96fd935ce0481a105e5` verified remotely. Its application code, tests, dependencies and workflow match the previously verified application source `5f8a6f7`; the intervening changes are documentation.
- With the owner's approval, remote `main` received only `.github/workflows/checks.yml` in commit `459f9d59ad7307165d705c75d045d44b615e0c0f`, registering the manual workflow. No application files on remote `main` changed. Local `main` and the stable tag remain at the protected baseline.
- [Release checks run 1](https://github.com/tlrdevere/harmonious/actions/runs/36210750517) passed **46/46 checks** on `e42f83ab9fb97b8484bda96fd935ce0481a105e5`, using a clean Ubuntu 24.04 checkout, locked dependencies and Chromium. This includes all six browser suites, disposable account/database tests, portable export, production build and asset/access checks. The successful job log confirms the complete count; a local evidence summary is saved at `build/hosted-release-verification.json`.
- The workflow uses `workflow_dispatch` only and read-only repository permissions, with no production credentials or deployment step. Automatic push/PR checks and automatic deployment remain disabled. Worker 44 remained the live release during that synchronization; no deployment or database change was performed then.
- Subsequent commits recording this result change documentation only and are separate from the exact tested revision above. Owner usability acceptance remains outstanding.

## Preceding node wording release

Node wording and Map/Create cleanup deployed September 25, 2026 at **20:00:38 UTC** (4:00 p.m. in New York). Application source: `885280d8931b575a074bbd3265accf3dde184011` on `redesign/node-interactions`.

- Worker version **43**: `ee44a623-3ccc-4e57-b305-d7e542effe98`, serving **100%** of traffic. Deployment: `ee1d7560-b74b-4d5f-b954-5a0afb3d634b`.
- User-facing entity labels now consistently say **node**. Saved data identifiers, types and authored wording are unchanged. Map/Create cards omit Frame/type footers with no replacement author label. Shared mode controls are ordered **Inquiry → Compare → Argument**.
- Selecting a node in Map/Create opens the on-map menu; Edit opens the optional panel. Close returns keyboard focus. Saving on-map confidence does not force the panel open. Signed-in save feedback no longer incorrectly demands a manual workspace save.
- **46/46 release checks passed**, including six browser suites, account/database tests, portable export and the production build. Report: `build/verification/2026-09-25T19-58-13-520Z-76692/summary.json`. New assertions cover absent footer labels, optional panel behavior, node creation wording, confidence/panel preservation, save guidance and mode order. The narrow Map/Create screenshot was visually inspected.
- Public verification confirms all **50 client files** and the homepage match the tested source, with sign-in configuration, anonymous account denial, private-configuration denial and security headers intact. Report: `build/public-node-ui-verification.json`. The first read during rollout encountered one previous-version file; a subsequent full check at 20:01:21 UTC passed. Worker SHA-256: `91e3278e3f9c4385a7ba8a5c674a995479518e9e2d03aced6d4ec7ccf5962d68`.
- All eight encrypted bindings, compatibility date `2026-09-08`, and empty compatibility flags were preserved. No database migration, live account test write, authentication change, dependency update or registry audit was needed. Source and notes are checkpointed locally; no GitHub push was made.
- No node-positioning or connection-routing algorithm changed. A disposable fixture produced identical geometry in Chrome and Edge across nine corresponding states. Expansion and historical proposal links can change edge grouping and shape, but the owner's exact two-browser disparity remains unconfirmed. The [follow-up review](ui-followup-2026-09-25.md) records the evidence and recommends consistent connection drawing as the next visual cleanup.

**Reload both PCs before testing.** Start with the node wording/map-editor section of [the checklist](user-testing-checklist.md). The preceding v4-compatible release is Worker 42/source `82997e6`; the pre-redesign stable tag remains unchanged.

## Preceding mode consistency release

Mode consistency deployed September 25, 2026 at **19:30:59 UTC** (3:30 p.m. in New York). Application source: `82997e60cc3be30c0cf7798f97ada4d7114263b1` on `redesign/node-interactions`.

- Worker version **42**: `9a29cf19-929b-418d-86d8-3a0426452e62`, serving **100%** of traffic. Deployment: `b2e25d7f-fdb9-410b-b8da-fe10bbccd397`.
- Compare, Inquiry, and Argument now share interaction labels, selected-ground previews, actual response outcomes, conversation counting and source navigation. Responses stay nested and do not inflate initiating-conversation counts. Badges open exactly their counted category.
- **Find** is available in all three modes with separate remembered queries. It searches choices, Other text, comments, accessible references and response outcomes. Argument offers All/Disputes without implying resolution. Show on map reveals the existing attachment, including folded sources, without making an extra Context card.
- Historical records, withdrawn replies and earlier individual outcomes remain readable. Retired creation, editing, adoption, reflection and source-confirmation routes are closed; supported counterpart fulfillment, definitions, confidence and explicit reviewed map application remain available. Current guidance and the owner checklist now describe the v4 workflow.
- **46/46 release checks passed**, including six browser suites, two-account persistence and permissions, history, mode-local drafts/search, recipient restrictions, keyboard access, narrow screens, portable export, build and complete asset checks. Report: `build/verification/2026-09-25T19-28-36-151Z-75492/summary.json`. Earlier attempts exposed a historical-view test adapter expectation and a test's hardcoded map-side assumption; both were corrected before the final passing run.
- Public verification confirms all **50 client files** and the homepage exactly match the tested checkout. Configured sign-in, anonymous account denial, private-configuration denial and security headers pass. Report: `build/public-consistency-verification.json`. Worker SHA-256: `e9a1e9a9d2b160909bd50d6339776aa0241ddfc3a72057d28f2cf98a429bf3d4`.
- All eight encrypted bindings, compatibility date `2026-09-08`, and empty compatibility flags were preserved. This release has no database migration, stored-data rewrite, live account test writes, authentication changes, dependency update or registry audit.
- Radial positioning is unchanged. Mode switches preserve source coordinates, camera, selection and folds. A [representative cross-depth counterpart study](design/counterpart-depth-study.html) identifies a separate placement tradeoff: a paired node can change displayed depth while its descendants retain theirs. That evidence does not diagnose or fix the owner's particular live map; a new displacement policy remains a separate design decision.

**Reload both PCs before testing.** Start with the mode-consistency checks in [the checklist](user-testing-checklist.md). Owner usability acceptance remains outstanding. Source and release notes are checkpointed locally; this release does not push to GitHub. The previous v4-compatible release is version 41/source `c0381c8`; `stable-before-interaction-redesign` and `main` remain at the older checkpoint and are not a database rollback. See [the completed consistency plan and remaining layout work](mode-consistency-plan.md).

## Preceding interaction grammar release

Interaction grammar v4 deployed September 23, 2026 at **00:25:01 UTC** (September 22 at 8:25 p.m. in New York), at the owner's request to test on the live site. Application source: `c0381c8` on `redesign/node-interactions`.

- Worker version **41**: `bd989842-33dd-4333-91d4-e061ddcecacd`, serving **100%** of traffic. Deployment: `93547ccd-0f96-4992-bedb-adeba0af6c2e`.
- **Compare** records Endorse, Disagree, or No position. **Inquiry** provides Request reason, Request explanation, Propose alternative, and Offer reason. **Argument** provides Dispute reasoning with frame/type Base options and source Add-ons. Intended recipients respond within the originating mode. References and comments are optional; Other opens free text; Signals remain internal.
- Map/Create uses statements and explicit typed connections. Recording positions or accepting proposals does not automatically edit maps; separate owner-controlled Review/Apply actions handle copies, reasons, and revisions. Counterpart requests, confidence, definitions, collapsed attachments, and parked mode drafts remain available. See [the grammar specification](interaction-grammar-v4.md) for prototype limits and deferred older controls.
- Migration `20260923002452_interaction_grammar_v4` is applied. The local file was renamed from `20260922222926` to match the connector-generated migration version. SQL SHA-256: `bf961933fb6af4f595da2c0db278df5bcad1d1b4cc61ed2d72f69a4ea05551ea`. No stored records were rewritten: before/after count **45**, generation **55**, content digest `8bf597572c7d9a4fed5b58f346867b3f`.
- All seven affected functions are security invoker, with empty search paths and service-only execute grants. RLS and direct anonymous/authenticated table denials remain intact. The interaction trigger is enabled. Live read-only menu checks return 13 choices for a cited Status Quo statement, zero for nesting, and the correct addresses wording. The original reflection helper's body checksum is preserved.
- **44/44 active release checks passed** before publication, including five browser suites, two-account flows, migration/permission tests, explicit application, retries, mobile views and build checks. Report: `build/verification/2026-09-22T22-53-25-909Z-38200/summary.json`. Older browser expectations retired by this redesign are explicitly listed in `package.json` and the grammar document.
- Public verification confirms all **48 client files** and the homepage exactly match the tested checkout. Configured sign-in, anonymous account denial, private-configuration denial and security headers pass. Worker SHA-256: `e2aff179e57899e8e44a90d0ab894cb1297c9a9df2f2107db760d3eaa509e470`.
- All eight encrypted bindings, compatibility date `2026-09-08`, and empty compatibility flags were preserved. Security advisors retain the existing two service-only [RLS-without-policy notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and existing [password-protection notice](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No authentication setting, live test account, dependency version, or registry audit changed.

**Reload both PCs before testing.** Use the new interaction checks at the top of [the testing checklist](user-testing-checklist.md). The stable tag and `main` remain at the pre-redesign checkpoint; deployment was direct through Cloudflare, not a GitHub push. Once new grammar records exist, use a forward fix: the older Worker cannot read the new interaction format. The stable source checkpoint is not a production database rollback.

## Preceding stabilization release

Stabilization, grouped outcomes and shared-map discovery deployed September 22, 2026 at **17:28:21 UTC** (1:28 p.m. in New York). Application source: `9fd1336`.

- Worker version **40**: `190c2303-0765-467e-ad97-580da77f8680`, serving **100%** of traffic. Deployment: `63cbc3fa-d918-406f-882d-1c7dd67da15e`.
- All five findings from the September 19 review are fixed: source previews show reference and node metadata changes; point/outcome withdrawal retries recover lost acknowledgments while retaining real conflict checks; finding an edge-attached point reveals both endpoints at the existing zoom; argument search includes saved premise summaries/details; the Library correctly labels the earlier-judgment review count.
- **Argument → Conversations** groups disagreement points with each owner's assessment and optional next step. Missing assessments are neutral. Outcomes remain authored independently, preserve history, and do not imply agreement or alter source maps/challenge resolution.
- **Map Library → Comparisons & arguments → Find a shared map** searches shared maps by map/person name, with predictable alphabetical ordering. **Compare with my map** preselects the other source and leaves the user's map choice explicit. Existing comparison search retains its empty-state message. No additional main tab or Compass placement was added.
- **46/46 release checks passed**, including ten browser workflows, disposable two-account tests, direct database regression tests, portable export, production build and asset checks. Final report: `build/verification/2026-09-22T17-21-40-805Z-50256/summary.json`. Earlier verification attempts caught an export text-encoding issue and a missing empty-search message; both were corrected before this passing run.
- New browser regressions cover reference-only changes on reasons/nodes, point/outcome lost-withdrawal acknowledgments, actual competing edits, structural and explicit edge reveal, preserved zoom, grouped two-author assessments/next steps, discovery search, private-map removal and mobile layout. Desktop/mobile discovery and grouped-outcome screenshots were visually inspected.
- Public verification confirms all **44 client files** and the homepage exactly match the tested checkout. Configured sign-in, anonymous account denial, private-configuration denial and security headers pass. Worker SHA-256: `6f0a0d320b089684f353aab0795c970e4fe8ee00df5fa609b809c6ab486e56ae`.
- All eight encrypted bindings, compatibility date `2026-09-08` and empty compatibility flags were preserved. No database migration, live account writes, authentication changes, dependency install/update or registry audit occurred.

**Reload both PCs before testing.** Start with the new discovery/overview checks and the short two-person example in [the checklist](user-testing-checklist.md). Owner usability acceptance remains distinct from automated coverage. Compass axes require a product decision; GitHub synchronization and hosted CI remain outstanding. Source and release notes are checkpointed locally.

## Preceding disagreement-point release

Attached disagreement points, individual outcomes and the Compare inquiry preset deployed September 19, 2026 at **06:33:16 UTC** (2:33 a.m. in New York).

- Worker version: `a6e61277-4a79-4d3d-9d43-945d42ea78ef`, serving **100%** of traffic. Deployment: `5b493cfb-5d40-47d0-b6f6-8f0e0b157f90`.
- In **Argument**, **Mark point of disagreement** attaches an authored description to an ordinary source node, source-map edge, reason, Argument response or Supports connection. Category is optional. Small attachment counts, folded-source access and the existing search keep notes discoverable without adding graph cards or edges.
- **Record my outcome** gives each participant one current personal assessment per point, with an optional label and next step. Outcomes remain separately attributed; edits retain history. They do not change either map, claim mutual agreement, or change challenge resolution. Compare excludes these Argument controls and indicators.
- **Compare → Ask → What would change your mind?** is an editable preset using the existing ordinary question record and response flow. Changing presets preserves custom text; silence has no automatic meaning.
- Staged saves preserve drafts through mode changes, conflicts and interrupted requests. Uncertain retries keep the same identity; subsequent edited text becomes a revision of the acknowledged note. Source changes before or during editing require explicit old/current review. Exact historical wording and status-only withdrawals survive source loss; fresh work requires available sources. Tall popovers reposition when optional detail opens.
- Portable schema **6** reads versions 1–6. `comparison-reflection-v1` protects current, historical and incoming annotation records from unsupported tabs before reads/writes. Unaffected older clients retain compatible envelopes. Prefer forward fixes after reflections exist rather than a Worker rollback to a pre-capability version.
- Migration `20260919062604_comparison_reflections` is applied. Supabase CLI 2.117.0 created it as `20260919061401`; the local file was renamed to match the connector's applied version. SQL SHA-256: `3a3061c5d9a8c81379e5888239e4993364c630022099c3b28d654e00a7228b62`. Three new functions are security invoker, with empty search paths and service-only execute grants. The before/after fingerprint is unchanged: 41 records, generation 48, digest `b1a29d265cc2eb8e7d5b49e432f59996`.
- **45/45 local release checks passed**, including nine browser walkthroughs, disposable two-account/database tests, portable export, production build and asset checks. Report: `build/verification/2026-09-19T06-29-39-475Z-75668/summary.json`. Coverage includes both participants' independent outcomes, actual source/inference targets, immutable history/snapshots, duplicate rejection, whole-batch rollback, retry identity, source review, private projection, search/folds, draft preservation and narrow layouts. Desktop/mobile screenshots were inspected.
- Public verification confirms all **44 client files** and the homepage match the tested build exactly. Configured sign-in, anonymous account denial, private-configuration denial and response security headers passed. Worker SHA-256: `ea525c5d2261ec9385ab6c0547c8d805642877c71301814bf6f45580a0c805aa`.
- All eight encrypted bindings, compatibility date `2026-09-08` and empty compatibility flags were preserved. No live test users or records, authentication changes, dependency updates or registry audit were needed. Security advisors remain at the existing baseline: two expected [RLS-without-policy notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) for the service-only store, and the existing [leaked-password-protection notice](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

**Reload both PCs before testing.** Begin with points and outcomes in the [testing checklist](user-testing-checklist.md), or follow the [current workflow](current-argument-workflow.md). [The feature contract](disagreement-points-outcomes.md) describes attribution and source-review rules. Owner usability acceptance, GitHub synchronization and hosted CI remain outstanding; source is checkpointed locally and this release does not push to GitHub. Compass axes/self-placement, shared-premise display, dragging and pods remain later work.

## Preceding existing-node reason release

Existing worldview nodes used as reasons deployed September 19, 2026 at **06:06:53 UTC** (2:06 a.m. in New York).

- Worker version: `c4fdd1ac-3009-4a9e-a119-354b23e78c58`, serving **100%** of traffic. Deployment: `b7b0f728-538b-419e-91e5-a1623af6b46b`.
- **Argument → Explain my reasoning / Add supporting reason → Use one of my nodes** searches the author's participating map within the matching frame. The selected position's identity, exact wording, reference and invoked definitions are retained in a separate reason card. The same position can support distinct conclusions through separate uses, without moving or copying source-map nodes. Compare retains inquiries and information requests.
- Both participants can inspect the referenced wording and separately challenge its statement or its Supports connection. Definition icons show only pinned invoked versions. Source edits require explicit **Review used node**; earlier wording and challenge snapshots remain intact. Confidence-only edits do not create wording warnings. Imported titles retain their exact spacing.
- Staged saves recover an already committed contribution after a lost response, before checking newer source changes. Source/conclusion moves refresh eligibility without trapping the form in invalid review attempts. Unavailable referenced ancestors block new work while historical reading and exact status-only withdrawal remain available. Drafts survive mode changes, and tall forms reserve space for the actual Argument toolbar, including wrapped narrow layouts.
- Portable schema **5** accepts earlier workspaces. The `comparison-premise-v1` capability protects affected older browser tabs before reads/writes, including references in history; unaffected clients retain compatible envelopes. Prefer a forward fix after referenced reasons exist rather than rolling back to a pre-capability Worker.
- Migration `20260919060236_existing_node_reasons` is applied. Supabase CLI 2.117.0 created the file as `20260919053611`; it was renamed to match the connector's applied version. SQL SHA-256: `0e94f4e096d43b5edc93b32bdb635e439c6de2bb0ae8c292fd74614731fdbcd7`. Three additive functions remain SECURITY INVOKER with empty search paths and service-role-only execution. Existing rows, tables and grants were not rewritten.
- Before/after database verification matches: **41 records**, generation **48**, content digest `b1a29d265cc2eb8e7d5b49e432f59996`. No live test accounts or contributions were created. Security advisors are unchanged: two intentional service-only table notices ([RLS explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)) and the existing Auth password warning ([password guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). No Auth setting changed.
- **42/42 final local release checks passed**, including all eight browser walkthroughs, direct database boundary/atomicity tests, portable export, production build and asset checks. Report: `build/verification/2026-09-19T06-03-43-931Z-73864/summary.json`. Coverage includes ownership/frame scope, exact definitions/history, two-account projection, source races, retry, duplicate/circular support, old clients, privacy and imported titles. Desktop and narrow screenshots were inspected.
- Public verification confirms all **42 client files** and the homepage exactly match the tested build, with configured sign-in, anonymous account denial, private-configuration denial and security headers passing. Worker SHA-256: `ed0af889d51582ff85b6fe43d7f554e5caf44291f2b4070e3a66255291a4cc1f`.
- All eight encrypted bindings, compatibility date `2026-09-08` and empty compatibility flags were preserved. No dependency-version change, new install, registry audit, GitHub push or hosted CI run occurred.

**Reload both PCs before testing.** Start with **Use an existing node as a reason** in the [testing checklist](user-testing-checklist.md), or read [the workflow](current-argument-workflow.md) and [reference design](existing-node-reasons.md). Owner usability acceptance, GitHub synchronization and hosted CI remain outstanding. The additional inquiry preset, explicit points of disagreement, overall outcomes and compass self-placement remain planned. Pods, dragging, arbitrary cross-frame support and a single shared reason card with several Supports connections remain deferred.

## Preceding mode-separation release

Compare/Argument mode separation and Library cleanup deployed September 19, 2026 at **05:23:03 UTC** (1:23 a.m. in New York).

- Worker version: `8b001a6e-6aaa-4f73-81b5-4d92710f00cc`, serving **100%** of traffic. Deployment: `f42be255-533b-4509-8ec5-300304d52ed4`.
- **Compare** provides questions, information requests, counterpart/adoption actions and agreement/disagreement recording. **Argument** provides reasons, statement/connection challenges, relationship contests and attributed outcomes. Menus, source indicators, grouped conversations and display controls now respect this boundary. Existing saved work remains accessible in its appropriate mode, with necessary earlier inquiry context preserved.
- Challenge forms begin with the author's explanation. **Type of challenge (optional)** is collapsed by default and retains General challenge, Reasoning does not follow, Counterexample, and Logical fallacy or reasoning error. These are authored assessments, not automatic verdicts.
- Mode switches preserve source selection and camera. Untouched and edited forms are hidden while in the other mode and restored on return; explicitly closed forms do not reappear. Selecting another target retains the explicit discard guard. Counterpart placeholders retain their geometry in Argument without request/add controls.
- My maps sort by latest update. Comparisons sort by actual accessible saved conversation activity, including responses. Reasons and challenges are counted separately; empty categories are omitted, earlier work is labelled separately, and an unmatched search shows a real empty result. Conversation indexes prioritize recent activity; follow-ups remain chronological. Argument search includes argument work and necessary ancestors, excluding unrelated inquiries; graph structure is unchanged.
- **39/39 local release checks passed**, including all seven browser walkthroughs, disposable account/database checks, portable export, production build and built-asset checks. Report: `build/verification/2026-09-19T05-19-52-332Z-69084/summary.json`. New regressions cover mode-specific absence/presence, parked drafts, optional challenge classification, earlier inquiry/argument ancestry, search scope and Library ordering/counts. Desktop and narrow screenshots were inspected.
- Public verification confirms all **40 client files** and the homepage exactly match the tested build. Configured sign-in, anonymous account denial, private-configuration denial and security headers passed. Worker SHA-256: `45001a356b7d4a1ea6391641c2451484684b2dc50d559b5a4a287f1eed59d155`.
- All eight encrypted bindings, compatibility date `2026-09-08` and empty compatibility flags were preserved. No database migration, live test data, authentication change, dependency-version change or registry audit was required.
- [Interaction and sorting rules](compare-argument-ui-rules.md) now document the current boundary and the next-feature design. Compass self-placement, existing-node premise reuse, a new change-of-mind inquiry preset and overall disagreement outcomes remain **planned**, not part of this deployment.

**Reload both PCs before testing.** Start with the mode-separation section in the [testing checklist](user-testing-checklist.md), or read [the current workflow](current-argument-workflow.md). Owner usability acceptance, GitHub synchronization and hosted CI remain outstanding. Source is checkpointed locally; the release does not push to GitHub.

## Preceding routing and confidence release

Comparison routing and personal confidence deployed September 19, 2026 at **04:58:57 UTC** (12:58 a.m. in New York).

- Worker version: `95def18b-53e2-4526-95db-dfadc4beb417`, serving **100%** of traffic. Deployment: `450e6945-29e9-45d7-ab94-23c46276c7ca`.
- Comparison relationships now attach to suitable card boundaries and route around visible cards and counterpart placeholders. This fixes the top-to-top curve crossing a card after asymmetric branch collapse. Labels sit on a clear part of the actual route; lines retain mouse and keyboard access. One visible edge per displayed node pair and all saved meanings are preserved. No node dragging or automatic reparenting was introduced.
- Owners can use **My confidence** on Position nodes in Maps and Compare. A quiet percentage badge shows the author's score; the owner can edit it directly, and the other participant sees it read-only. The numeric editor preserves arbitrary valid values such as 73% and 64.5%; zero remains distinct from **Not assessed**. Frame headings, topics, questions and separate argument cards are not assigned scores.
- Confidence stays personal metadata. Confidence-only changes preserve wording identity/version and no longer mark legacy comparison wording stale; saved historical snapshots remain intact. Fixed a stale hidden-editor path that could revert a Compare score after Refresh, and preserved unrelated inspector edits when cancelling a confidence draft.
- **38/38 local release checks passed**, including seven browser walkthroughs, disposable account/database checks, portable export, production build and built-asset checks. Report: `build/verification/2026-09-19T04-54-59-120Z-81660/summary.json`. New coverage checks card-boundary geometry, asymmetric collapse, real pointer/keyboard access, score ownership, arbitrary-value persistence and in-app refresh/save behavior. Desktop and narrow screenshots were inspected.
- Public verification confirms all **39 client files** and the homepage match the tested build exactly. Sign-in configuration, anonymous account denial, private-configuration denial and security headers passed. Worker SHA-256: `baedd6607f6b5f45c72b0a80455a6d4da21a00a458ff4fc7d7a47f44240e4182`.
- All eight encrypted bindings, compatibility date `2026-09-08` and empty compatibility flags were preserved. No database migration, live test data, authentication change, dependency-version change or registry audit was required.
- Completed the [process-design review](process-design-review-2026-09-19.md) and a [compass discovery design preview](design/map-discovery-compass.html). The compass is **not a live feature**: examples are fictional, axes are provisional, and placements remain in the demo browser session. Actual discovery self-placement awaits final axis wording and implementation.

**Reload both PCs before testing.** The [testing checklist](user-testing-checklist.md) starts with the routing and confidence changes. Owner usability acceptance, GitHub synchronization and hosted CI remain outstanding. The next Argument design priority is reusing existing worldview positions as reasons; pod design and manual dragging remain deferred.

## Preceding Argument navigation and adoption release

Argument folding, on-map search and recipient-controlled adoption deployed September 19, 2026 at **04:25:36 UTC** (12:25 a.m. in New York).

- Worker version: `643ab22e-99ee-42de-a21b-13af900de765`, serving **100%** of traffic. Deployment: `27902cf3-367d-4ca0-ba0f-a94fc74e1bda`.
- Cards and **Supports** connections have independent personal follow-up folds, with hidden-card and open-challenge counts. Folds preserve the clicked position and zoom, stay independent between users, retain unfinished forms, and survive mode/Comparison changes during the page session.
- **Find in argument** searches the whole accessible Comparison with All/Open challenges filters. **Show on map**, **Earlier steps**, **Back to selected contribution**, and **Browse all contributions** keep long discussions reachable while drawing at most 40 cards. Omitted ancestors never produce a false support connection. Finding/following preserves zoom; Fit is explicit.
- Adoption recipients can create an edited independent node under a chosen parent, identify an existing node without altering it, or choose Not now and reconsider later. Counterpart linking and exact invoked-definition imports are optional and initially unchecked. No agreement or co-sign is implied.
- Adoption saves the node/idea, selected library imports and invocation, optional neutral link, and immutable receipt in one atomic batch. The app confirms saved data before changing the local map. Changed sources require explicit review while keeping the draft; repeated clicks, lost responses and competing tabs do not create duplicate placements. Withdrawn suggestions block new fulfillment but retain existing copies; receipts identify changed or removed destination nodes.
- Portable schema **4** reads versions 1/2/3. `comparison-adoption-v1` supplements the existing reasoning capability guard. Older clients receive a recovery message before accessing unsupported records. Prefer forward fixes rather than a pre-adoption Worker rollback after these records exist.
- Migration `20260919042425_adoption_fulfillment` is applied. Supabase CLI 2.117.0 created the source file; it was renamed from `20260919035631` to match the applied connector timestamp. SQL SHA-256: `bf195e9e4687223f1c306469dfe23ecc4c73571c74734558c117c070fe680f50`. It adds validation functions/triggers and extends validation without rewriting saved rows or widening client access. All three added functions are SECURITY INVOKER, use an empty search path, and are executable by the service role only.
- Database contents before and after migration match exactly: **41 records**, generation **48**, digest `a30e085d12ffc32e1044e1d66c3f1958`. No live test accounts or contributions were created.
- A fresh isolated dependency install and **35/35 release checks passed**: 26 application/account scripts, portable export, six browser walkthroughs, production build and built-asset checks. Coverage includes 80-step/200-sibling arguments, draft/privacy protection, Unicode definition ordering, direct database forgery rejection and atomic rollback. The database suite passed again after reconciling the migration filename. See [the verification record](release-checks.md).
- Public verification confirms all **36 client files** and the homepage match the tested bundle exactly. Configured sign-in, anonymous account denial, private-configuration denial and security headers passed.
- Worker SHA-256: `644a0a94eac296e193b01d3e9f99d34493ae3960ea13f9539c9c12da87dde809`. Main and clean-install builds match. All eight encrypted bindings, compatibility date `2026-09-08` and empty compatibility flags were preserved.
- Playwright **1.62.1** is pinned as a development dependency; prior dependencies remain unchanged. A manual-only, read-only GitHub Actions workflow is prepared without production credentials or deployment steps. Hosted Ubuntu/Chromium has **not** run, and source has not been pushed. No registry vulnerability audit was performed; the [dependency disclosure follow-up](dependency-review.md) remains separate.
- Security advisors are unchanged: two intentional server-only table notices ([RLS explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)) and the existing Auth password warning ([password guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)). No Auth settings changed.

**Reload both PCs before testing.** Use [the current workflow](current-argument-workflow.md) and [the updated two-account checklist](user-testing-checklist.md). Owner usability acceptance and hosted CI execution remain outstanding. Dragging, pod design, automatic merging and arbitrary reasoning links remain deferred.

## Preceding shared Argument release

Shared Comparison Argument mode deployed September 19, 2026 at 03:26 UTC (September 18 at 11:26 p.m. in New York).

- Worker version: `749a4446-4096-4106-9976-47e8acf7e2a3`, serving 100% of traffic. Deployment: `6aa90a97-943e-4435-a324-f0bf57f1162c`.
- **Compare** and **Argument** are compact modes of the same shared Comparison. Selecting one's own ordinary node offers **Explain my reasoning**; authors can add supporting reasons to their own reasons and Argument responses. No question, proposal, agreement or co-sign is required.
- Participants can challenge a source position, a reason's statement, or its **Supports** connection separately, then respond, accept/maintain, and resolve/reopen with explicit authorship. Acceptance does not resolve another person's challenge automatically.
- Reasons, challenges and responses appear as source-attached cards. **Follow argument**, **Fit argument**, **Back to source** and **Collapse argument** preserve access through collapsed counters. Automatic connectors avoid source/reason cards, keep Supports labels clear and indicate the support direction. Source-map structure and positions are unchanged.
- Optional reference links and exact invoked definitions/standards are available in reasoning contributions. Earlier wording, endpoint snapshots, withdrawn ancestors and private-map access remain protected. Authors can withdraw unchanged child contributions after their parent is withdrawn.
- New portable workspaces use schema version 3 and read versions 1/2. Capability checks stop unsupported older clients before receiving or saving new reasoning records, with a recovery message. Earlier proposal-based graphs remain under **Earlier reasoning**. Prefer forward fixes; do not deploy a pre-capability Worker after new reasoning is saved.
- Migration `20260919032433_comparison_reasoning` is applied. The file was first created with Supabase CLI 2.117.0, then renamed to the migration connector's applied timestamp. It replaces only the existing conversation validation trigger function, retaining SECURITY INVOKER and an empty search path. No table, grant or stored contribution was rewritten.
- Before/after database verification: **41 records**, generation **48**, content digest `a30e085d12ffc32e1044e1d66c3f1958` unchanged. No live test accounts or contributions were created.
- All **24 application/account test scripts** and **four browser walkthroughs** passed, including isolated two-account reason/inference/response flow and direct PostgreSQL boundary tests. Final routing checks verify complete badge clearance and rendered SVG geometry. Portable export, portable reopen/navigation, production build, complete module graph and security-header checks passed.
- Public verification confirms all **33 client files** and the homepage exactly match the tested release. Configured sign-in, anonymous account-access denial and private-configuration denial passed. The first public read was blocked by the local network sandbox; the approved read-only retry passed.
- Local Worker SHA-256: `cbe0d0302b7a5d9d4ba49ed8ff7913e8ec33ef851f743eb79ed168bb6598fd9b`. All eight encrypted bindings, compatibility date `2026-09-08` and empty compatibility flags were preserved. No dependencies were changed or registry inventory sent.
- The security advisor reports only the existing server-only table notices ([RLS explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)) and existing Auth password warning ([password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)); no Auth settings or grants changed.
- Read [the current Argument workflow](current-argument-workflow.md) and [the updated two-account checklist](user-testing-checklist.md). **Reload both PCs before testing.** The owner's live usability acceptance is still outstanding. Source is checkpointed locally with this release; it has not been pushed to GitHub.

The canvas expands one source group and displays up to 40 cards with necessary ancestors retained; list access exposes the rest. Finer subbranch folding, denser-graph navigation, hosted CI and recipient-controlled adoption fulfillment remain follow-ups. Dragging, pod design and arbitrary graph cross-links remain deferred.

## Preceding single-edge release

Single comparison edges and linked-counterpart request cleanup deployed September 19, 2026 at 01:21 UTC.

- Worker version: `6802bb32-fd1a-40bf-b289-fd0df1ed9d88`, serving 100% of traffic. Deployment: `0f919609-89b5-4c6d-9cf2-e21df1e79ba0`.
- Linked nodes no longer offer Request counterpart, including within the counterpart chooser. New requests against an already-linked source are also rejected by the save validator. Frame headings do not offer counterpart requests.
- Compare draws one visible edge per displayed node pair. Structural and illustrative/source connections share a path and hit area; counterpart links, judgments and earlier comparison records share one cross-map connection. Collapsed endpoints are grouped too.
- Saved meanings and authorship remain separate and accessible from the combined connection. Conflicting judgments display a neutral Mixed judgments label. Source-edge definitions and attached conversations remain accessible, including those attached to secondary meanings.
- All 21 application/account scripts, all three browser walkthroughs, portable export, build and whitespace checks passed. New coverage reproduces structural-plus-illustrative duplicates, counterpart-plus-agreement duplicates, conflicting judgments, collapsed endpoints and hidden request actions.
- Public verification confirms all 30 client files and the homepage match the tested release; sign-in, account gates, private configuration denial and security headers passed.
- Local Worker SHA-256: `3196ee7c89970551a3e2f9cf5aeb9a8c2b60cda870c0fbfc23276bfa1b8502ef`. All eight encrypted bindings and compatibility date `2026-09-08` were preserved. No schema migration, package change or live test data was required.
- Reload both PCs. Source was subsequently checkpointed locally as `94a8033` during [Argument preparation](argument-preparation-status.md); it has not been pushed. Preparation did not change the live release.

## Preceding counterpart release

Counterpart placeholders and fulfillment deployed September 19, 2026 at 01:06 UTC (September 18 in New York).

- Worker version: `5fcf69fd-56aa-47e0-86a6-d54628f373ec`, serving 100% of traffic.
- Deployment ID: `a3302d0b-80fe-4a64-8daa-9ff2c431c412`.
- Selecting an unmatched ordinary node shows an empty counterpart spot. An open request keeps it visible for both participants. The recipient can create a node under a chosen parent in their own map or link an existing node.
- Counterpart connections are saved independently of agreement/disagreement. Explicit pairs override sibling-order placement within a frame. Cross-frame links preserve source-frame membership; original map parents are never rewritten by comparison layout.
- No-position/not-applicable responses and author-controlled close/reopen actions preserve the request history and leave compact status indicators.
- All 20 application/account test scripts, the three complete browser walkthroughs, portable export, build verification and whitespace checks passed. PostgreSQL tests exercise direct creation plus linking in one save and account permissions. No database migration or live test record was needed.
- Public verification confirms all 30 client files and the homepage match the tested release, plus sign-in configuration, anonymous access denial, private configuration denial and security headers.
- Local Worker SHA-256: `75813bcf9a672775680ca64b2f16686a80b74c262007e8c3b637003be615d288`.
- All eight encrypted bindings and compatibility date `2026-09-08` were preserved. No dependency inventory was sent and no package versions were changed.
- Reload both PCs before testing. Older clients do not recognize correspondence contributions, so use forward fixes rather than a writable rollback to a pre-counterpart release. Source remains in the local working tree, not committed or pushed.

See [the counterpart workflow and layout boundaries](counterpart-workflow.md).

## Preceding attached-conversation release

Attached conversations, reusable definitions and authored challenge outcomes deployed September 12, 2026 at 04:56 UTC.

- Worker version: `aebd17c6-674a-42b8-a7c5-2b8750884b03`, serving 100% of traffic.
- Deployment ID: `e32e1194-a575-4973-b517-d530abe787ed`.
- Source node footers and connections expose collapsed question/request and challenge counters. Hidden conversation types and collapsed branches retain discoverable indicators.
- Definitions & standards live inside Map Library. Authors create and reuse explicitly versioned definitions on their own nodes/edges; other users see only invoked wording from accessible sources.
- Focus arguments lists open/resolved challenges. Parent links, responses, acceptance/maintained positions and challenger-only resolve/reopen actions preserve authorship and history.
- Database migration `20260912045603_definitions_library` is applied and saved locally under the database-generated timestamp. The Supabase CLI was unavailable, so the migration connector generated the timestamp. All existing row counts and content digests matched before and after migration; no live test records were created.
- Application/account tests, the PostgreSQL migration and privacy tests, both complete browser walkthroughs, portable export and production build checks passed. Public verification confirms all 28 client files and the homepage match the tested release, plus configured sign-in, anonymous access denial, private configuration denial and security headers.
- Local Worker SHA-256: `da6484b90fa29dc77a0db467b6bdee5ccbb960fcbee193660a85a42d8f4182f3`.
- All eight encrypted bindings and compatibility date `2026-09-08` were preserved. The security advisor still reports the intentional server-only RLS tables and the existing leaked-password-protection warning; this pass did not change Auth settings.
- Reload older tabs before testing. Source remains in the local working tree, not committed or pushed. Prefer forward fixes; older Workers do not preserve the new definitions record kind reliably. Do not roll the database schema back after library entries exist.

See [delivered behavior and boundaries](attached-conversations-library.md) and [the testing checklist](user-testing-checklist.md).

## Preceding focused-action release

Focused comparison actions deployed September 12, 2026 at 03:22 UTC.

- Worker version: `b569ce8e-7cf8-4edb-a4f1-7b72b6906653`, serving 100% of traffic.
- Deployment ID: `3f48d2ac-ebbf-415f-a725-e7acc7f7a45b`.
- Relationships identify their recorder clearly and expose **Ask about relationship**, **Contest agreement/disagreement**, and author-only management instead of a generic Reply/Support/Evidence cluster.
- Other people's nodes and edges offer focused **Ask** and **Challenge** flows. Challenge choices are General challenge, Reasoning does not follow, Counterexample and Logical fallacy or reasoning error. Submit labels state the action being taken.
- Own nodes offer **Request counterpart** and **Suggest adoption**. New per-node definition creation is paused; existing definitions remain readable and author-editable until the central library is implemented.
- Compared node footers show the owner's name without the redundant “Frame” label. The optional docked panel control was removed; the focused window remains on the canvas.
- All 18 application/account scripts, both full browser walkthroughs, portable export checks, generated Worker checks and whitespace validation passed. Browser coverage includes the focused action sets, cross-account contests and responses, adoption requests, legacy-record compatibility, mobile containment and full-canvas draft preservation.
- Public verification passed for all 25 client files and the homepage alias, configured sign-in, unauthenticated workspace denial, private configuration denial and security headers.
- Local Worker SHA-256: `48ad108bd7e809e7a51ce51ee77b07299d7e9b45c3c4e12aff3845629f68cbae`.
- All eight encrypted bindings and compatibility date `2026-09-08` were preserved. No database migration, sign-in setting change or live test contribution was made.
- Reload older browser tabs before evaluating the layout. The source remains in the local working tree, not committed or pushed.

## Preceding compact-header release

Compact comparison navigation and map ownership styling deployed September 11, 2026 at 20:14 UTC.

- Worker version: `f946957f-5542-4edc-a83e-6e7f8d0a1b81`, serving 100% of traffic.
- Deployment ID: `316b7593-8ae3-47cb-ac76-26531e183931`.
- On wide screens, the brand and main navigation share the first row; comparison identity and actions share the second. Each compared map has a stable blue or amber ownership key based on map identity.
- Local Worker SHA-256: `163bda973412acb446ab5a5f77e6370f9229fb23caf86c3715ceec0ca43cb144`.
- All eight encrypted bindings and compatibility date `2026-09-08` were preserved. No database migration or live test contribution was made.

## Preceding canvas, history and reasoning release

Compact canvas, source history and on-map reasoning deployed September 11, 2026 at 18:54 UTC.

- Worker version: `117462b4-1a3f-4807-a469-5252a67962cc`, serving 100% of traffic.
- Deployment ID: `04878d5f-239d-4d55-bb6c-ab8578d1a103`.
- Includes View options, compact/expandable conversation markers, Full canvas with preserved drafts/status, immutable original source snapshots, review warnings and reviewed snapshots, support/evidence actions with reference links, and arrows between contributions. See [behavior and remaining boundaries](canvas-history-arguments.md).
- All 18 application/account scripts, both browser walkthroughs, portable export checks and production Worker checks passed. Additional coverage includes mouse edge selection, nested evidence, source review and mobile full-canvas drafts.
- Public verification passed for all 25 client files and homepage alias, configured sign-in, unauthenticated workspace denial, private configuration denial and security headers.
- Local Worker SHA-256: `e98012a53005123a49649afe985a9b5b5530946b9260cdc8da24a5085ada3eb3`.
- All eight encrypted bindings and compatibility date `2026-09-08` preserved. No database migration, sign-in setting change or live test contributions.
- The authorized dependency lookup completed; two development-tool advisories remain tracked in [dependency review](dependency-review.md).
- Reload older browser tabs before editing. Do not use a pre-snapshot Worker as a writable rollback: its editor can drop the new fields. Use a forward fix or a rollback build that preserves snapshots. No database rollback is required.
- Source remains in the local working tree, not committed or pushed.

## Preceding hover release

Quieter comparison edge hover deployed September 11, 2026 at 18:33 UTC.

- Worker version: `f12234a5-4065-4139-b1be-004c5ae7aab9`, serving 100% of traffic.
- Deployment ID: `a6b02057-2770-4414-ab43-c6c2a17b5f68`.
- Source-edge hover uses a softer tint, rounded ends and a 140ms fade. The clickable area remains unchanged. Keyboard focus remains stronger and immediate; reduced-motion preferences disable the fade.
- Existing on-map browser checks and production Worker checks passed. All public client assets match the build, and account-gate/security-header checks passed.
- All eight encrypted bindings and compatibility date `2026-09-08` preserved. No account, database or dependency changes.
- Local Worker SHA-256: `829a14a5793de13db52a11fc75eb981160c23801efeb5530183ed8a6412599c5`.
- Source remains uncommitted. The reviewed release below is a compatible rollback target.

## Preceding code-review release

Code-review fixes deployed September 11, 2026 at 18:12 UTC.

- Worker version: `88e89f09-329b-4be7-b532-2c8a81381ac7`, serving 100% of traffic.
- Deployment ID: `e5296290-6e15-4115-af9e-fc1103f5f5b2`.
- Fixes canvas containment and focus scrolling, adds records-panel closure and focus restoration, preserves the camera on contribution saves, prevents relationship labels from covering nodes, and validates conversation reference chains. See [review findings and next work](code-review-2026-09-11.md).
- All 18 application/account test scripts, both browser suites, regenerated portable export startup and production Worker checks passed.
- Public verification passed for all 25 client files plus the homepage alias, with exact content matches. Configured sign-in, unauthenticated account rejection, private configuration path and security-header checks passed.
- Local Worker SHA-256: `e56fc7eefd8ca9225805e599abf132babe301608f8c87685f679e580f3e82794`.
- All eight encrypted bindings and compatibility date `2026-09-08` verified unchanged. No migration or participant-data change was performed.
- Mobile toolbar density, compact conversation display and source-change review remain unfinished product work. External dependency-advisory checking awaits specific approval after an automatic review rejection.
- Source remains in the local working tree; it has not been committed or pushed. The preceding Worker version below is the rollback target; no database rollback is needed for this release.

## Preceding canvas cleanup

Canvas-first comparison cleanup deployed September 11, 2026 at 13:06 UTC.

- Worker version: `2dc8651c-0230-4669-9b72-cee249da7e60`, serving 100% of traffic.
- Deployment ID: `8e3cf9fb-a344-4534-9ce5-f2826567e3a8` (verified from the deployments endpoint).
- The comparison canvas now uses the available width, opens earlier records in a drawer, focuses the selected pair, tightens overlay spacing, and keeps the primary map and conversation controls compact. Node dragging and rearrangement remain deferred.
- [Five on-map comparison features](on-map-conversations.md): immediate agreement/disagreement, counterpart requests, inquiries, arguments on nodes and edges, and author definitions/standards. Independent Map/Inquiries/Arguments visibility and an optional docked panel.
- Supabase migration `20260911094003_on_map_conversations` applied. Existing record counts and content digests are unchanged. RLS remains enabled; application RPCs remain security-invoker and unavailable to anonymous/authenticated client roles.
- Existing eight encrypted Worker bindings and compatibility date `2026-09-08` preserved. No sign-in settings changed.
- Application/account/PostgreSQL suites and both browser walkthroughs passed, including mobile, drafts, older Argument records and portable export. No live test contributions created.
- Public checks passed: ten frontend files exactly match this checkout; homepage/sign-in configuration, unauthenticated workspace rejection, private configuration path and security headers pass.
- Local Worker SHA-256: `a574a13c401ef1ae1f9b57663193d808ad143ddad75ef4c747171bbd55ee8c18`.
- Node dragging and rearrangement are deferred by the owner. Source remains in the local working tree, not committed or pushed to GitHub.
- The preceding Library Worker can be restored without reversing the additive database migration. It will not display the new conversation records; do not remove those records or roll the database back.

## Preceding Library release

Map Library release deployed September 11, 2026 at 03:22 UTC (September 10, 11:22 PM Eastern).

- Worker version: 5d5434f7-1af9-492e-ab40-98403a574b65, serving 100% of traffic.
- Deployment ID: 67af585f-4630-40d5-a8bb-44bbbf72b886.
- Includes [Map Library, combined Compare/Argument modes, source browsing and inline node actions](library-release.md), plus the pending Argument fixes.
- No database migration or authentication change. All eight existing encrypted binding names were verified after deployment. Compatibility date remains 2026-09-08.
- Application/account/PostgreSQL tests, two-session browser walkthrough, keyboard/mobile checks, portable export runtime and generated Worker routing all passed locally.
- Final public-URL verification passed with `scripts/check-live-release.mjs`: all seven checked frontend assets exactly match the local build; the homepage and configured sign-in session respond successfully, unauthenticated workspace access returns 401, `.dev.vars` returns 404, and security headers pass. Local Worker SHA-256: `2c43f2f7803146c3d323aa54b35e738a6fd21b14cdabad525a097cb079935614`.
- No live test contributions were created. The owner's real-account acceptance walkthrough remains in [user-testing-checklist.md](user-testing-checklist.md).
- Source remains in the local working tree; it has not been committed or pushed to GitHub.
- The preceding Argument version below remains a compatible rollback target. Do not roll back to a Worker predating the overall-Comparison migration.

## Preceding Argument release

Argument release deployed September 10, 2026, at approximately 21:24 UTC.

- Website: https://harmonious-beta.tlrdevere.workers.dev
- Worker version: `f849bec4-287f-4a1c-b708-768435490952`, serving 100% of traffic.
- Deployment ID: `9e42ea7c-6034-41c8-a612-bea74e34159a`.
- Includes durable overall Comparisons, proposal revisions, clarification, review/history cleanup and the initial separate [Argument view](argument-view.md).
- Applied migrations: `20260910212254_overall_comparisons` and `20260910212326_argument_records`, after the two earlier migrations. Local filenames now match the actual remote migration timestamps.
- Preserved all 33 existing record contents and backfilled two parent Comparisons. All three existing proposals have a valid parent. Both account projections validate against the migrated live snapshot.
- Rehearsed migrations against an isolated copy of the actual records before production. Private before/after snapshots are under ignored `build/release-backup/`; do not commit or publish these backups.
- Homepage, Argument modules and session endpoint return 200; unauthenticated workspace returns 401; `/.dev.vars` returns 404. Runtime bindings were inherited without reading or changing secret values.
- PostgreSQL migration/persistence and comparison migration tests pass. All four application functions remain `SECURITY INVOKER`; both tables retain RLS and deny direct browser-role access.
- Browser is signed out. Visual acceptance and the live two-account contribution/reopen test remain pending user sign-in. No live test contributions were created, and no historical judgments were re-attested by the agent.
- Security advisor reports the existing service-only RLS-without-policy notices and [disabled leaked-password checking](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). This application's current sign-in uses email codes; no password settings were changed.
- Source remains in the local working tree; this release has not been committed or pushed to GitHub. Roll forward with a parent-compatible Worker if needed; the earlier live Worker cannot safely write proposals after the parent migration.

The next navigation and interaction pass is tracked in [next-work-plan.md](next-work-plan.md); the owner walkthrough is in [user-testing-checklist.md](user-testing-checklist.md).

## Previous release and preparation history

The sections below record the earlier release and its subsequent local preparation; their pending/deployed wording is historical. The current release above supersedes it.

- Website: https://harmonious-beta.tlrdevere.workers.dev
- Source: local tested working tree based on [49940048c7f4001deaeedd2d2a935f50c1f8ea5d](https://github.com/tlrdevere/harmonious/commit/49940048c7f4001deaeedd2d2a935f50c1f8ea5d); this shared-Comparison update has not yet been committed to GitHub.
- Cloudflare account: `de8bd4e6fd63290ed1f91b607d1f6b56`; Worker: `harmonious-beta`.
- Deployment: `d88174795aec4597a5ff02adeee48080`.
- Worker script tag: `921db8a29bac4e858c77840f4668e9ab` (a stable script identifier, not a release version).
- Uploaded September 10, 2026 at 04:58:29 UTC, using compatibility date `2026-09-08`.
- Compare overlays both maps in a shared frame layout, keeps source identities visible, provides A/B highlighting, and saves elicitation questions for a node or candidate pair. It now also creates one shared Comparison for the owners of two shared maps, records separate judgments, and marks pending, agreed, or differing judgments. The register first lists overall map-to-map comparisons; opening one reveals its proposed judgments above the judgment form. See [Compare overlay](compare-overlay.md).
- Prior Worker version: `9488030d-1602-4419-bf20-616d98570512`.
- Supabase migration `20260910043435_allow_shared_comparison_judgments` is applied. It retains `SECURITY INVOKER` and allows the server-validated second map owner to update their judgment in a shared Comparison. Runtime secrets were inherited and their names verified after upload.

## Accounts and email

- Supabase project: `hpjsieqbpnazpnjtyzdv`, in the Unanimous-Lovable organization, us-east-1.
- Migration `20260908233252_harmonious_accounts` is applied.
- Public signup uses `SIGNUP_MODE=public`; no invitation list is required.
- Turnstile and native Supabase CAPTCHA were disabled at the owner's request. Email verification and Supabase rate limits remain the signup controls. Previously configured Turnstile secrets remain stored but are unused by this release.
- Encrypted Worker bindings: `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `SIGNUP_MODE`. Values are kept out of source control.
- Resend's `harmonious.forum` sending domain is verified. SMTP uses `smtp.resend.com:465`, username `resend`, and sender `Harmonious <noreply@harmonious.forum>`. A sending-access API key is saved privately in Supabase.
- The owner confirmed receiving signup confirmation emails and reported two accounts working. The actual signup message contained a confirmation link; do not assume every Auth template currently sends a numeric code. The Magic Link template was configured for codes.
- Auth Site URL is `https://harmonious-beta.tlrdevere.workers.dev`.

## Verification and access boundaries

- Application, comparison, account API, embedded PostgreSQL, autosave, signup, and generated Worker checks passed before release. The live homepage and session endpoint both returned `200` after this deployment.
- Comparison tests include 100 expansion/filter patterns, unequal trees, independent source IDs, collapsed endpoints, source snapshots, and elicitation review history.
- Live homepage and updated Compare modules return 200. The session endpoint returns 200 with `configured:true` and public signup; unauthenticated workspace returns 401; `/.dev.vars` returns 404.
- Automated visual inspection of the local preview was blocked by browser URL policy. The owner provided visual acceptance. An authenticated live save/reopen test of the new elicitation state has not been performed by the agent.
- Both application tables have RLS enabled, and browser roles cannot directly access the tables or RPCs. The Worker checks identity, ownership, visibility, and revisions before using the service role. RPCs use `SECURITY INVOKER`.
- Informational RLS-without-policy notices match this server-only access design; do not add permissive policies to silence them.
- The service role may check account IDs but cannot select account email addresses from `auth.users` through SQL.

## Next development

Local cleanup after this release is not yet deployed. It strengthens comparison access and judgment history, pins each person's reviewed sources, corrects agreement detection, refreshes the review form, and restores the Windows account-test entry point. Existing shared judgments without individual snapshots will require source review when this cleanup is released. See [code review and Argument readiness](argument-readiness.md) for findings, validation and the recommended implementation sequence.

The durable overall Comparison foundation is now also implemented and tested locally: an empty saved parent, safe start/open from either owner, one parent per map pair, proposal links and direct navigation. Migration `20260910212254_overall_comparisons.sql` is prepared and tested against existing data fixtures, but is not applied live. See [overall Comparisons](overall-comparisons.md) for the coordinated database/Worker rollout and compatibility limits.

The local build now includes numbered proposal revisions, individual clarification responses and independently confirmed divergence after both people review the same responses. Changes invalidate earlier review without deleting history. This adds JSON fields and Worker authorization checks; it needs no SQL migration beyond the pending overall-Comparison migration. See [proposal review](proposal-review.md). The first Argument view is also implemented locally; see [Argument view](argument-view.md).

Argument adds separate authored Ground, Evidence and Value nodes and directed supports, evidence-for and rebuttal connections over each proposal version. It preserves source maps, histories and drafts between views. The new migration `20260910212326_argument_records.sql` is tested locally and must follow the pending parent migration before the matching Worker is deployed. Application, account, PostgreSQL and Argument controller checks pass; visual and live two-account acceptance remain pending.

The owner prioritized Compare and then Argument. Argument should be a separate view built on comparison records. Pod-map design, the custom website domain, and automatic GitHub deployments are deferred.

Compare still needs semantic alignment beyond provisional sibling placement, decisions about displaying equivalent statements, and richer elicitation conversations. Shared comparison judgments are deployed; the live overall list groups those judgments by map pair. A persisted parent, proposal revisions and the minimal clarification workflow are implemented in the pending local release. The first Argument view is implemented locally and is pending release.

Cloudflare's GitHub build connection is not configured; this release was built locally and uploaded through the Cloudflare connector. The `harmonious.forum` domain is currently used for email; it has not been connected as the app's primary URL.

## Earlier release

The first independent deployment used source `ce1d64e2e3b9da35ef95c73dc51ccb727ec9031f`. The original license and prior-art notice remain in the repository. The initial database boundary and unknown-account rejection were verified before testers joined.
