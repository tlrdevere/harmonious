# Sign up and sign in cleanup implementation plan

October 23, 2026. **Status: implemented locally; joint release verification pending.** This cleanup and [in app notifications](notifications-plan.md) will be published together after the full local and hosted checks pass. Worker 71 remains the recorded live baseline until [deployment status](deployment-status.md) records the verified release. The technology stack is unchanged.

## Outcome and scope

Returning users choose **Sign in**, enter their email address, and enter the code sent to that address. They do not supply a display name or create a password. New users choose **Create account**, provide an email address and initial display name, and verify their email with a code. Keep **Use a test account** as the separate organizer-issued username/password flow.

The same accounts, map IDs, comparisons, contributions, facilitator permissions and saved names remain in place. Password login for normal accounts, social login, passkeys, changes to signup eligibility and changes to email delivery providers are outside this increment. Notifications are a separate implementation plan.

## Implemented behavior

`dist/account-ui.mjs` now opens on **Sign in** with email only and provides a separate **Create account** choice with an initial display name. Both use an email code. The code screen identifies the destination email and offers Resend code and Change email. An immutable pending request retains its email, intent and signup name across resends; stale send responses cannot reopen an abandoned attempt. Verification and test-account sign-in prevent a competing identity change while cookies are being established.

`worker/account-auth.mjs` requires an explicit `signin` or `signup` intent. Sign-in sends `create_user:false` without any metadata; signup sends `create_user:true` with the initial display name. Only the documented unknown-user sign-in result receives the generic send acknowledgement. Rate limits, service failures and invalid/expired codes retain actionable errors. Clients without intent are asked to refresh rather than silently creating an account. The browser still talks to the Harmonious Worker, which uses raw HTTP requests to `/auth/v1/otp` and `/auth/v1/verify`; no new authentication dependency is introduced.

The canonical profile remains authoritative. `accountWorkspace()` in `worker/account-api.mjs` returns that saved profile name and creates an initial profile/private map only if the profile does not yet exist. Duplicate signup and ordinary login do not replace a saved name or create another private map. The account-menu **Change display name** action remains an authenticated, owner-only, revision-checked save.

Turnstile and native Supabase CAPTCHA were disabled at the owner's request. Preserve that setting and the dormant challenge component. Email verification, provider rate limits, public/invite eligibility and the separate test-account restrictions remain in force.

## Focused verification

The account-signup, account-api and test-account tests pass, along with the new `tests/auth-cleanup-browser.test.mjs` and existing test-account browser suite. Browser checks use the real Worker handler with disposable memory/Auth fixtures: they send no real participant email. Coverage includes email-only sign-in, unknown-account protection, signup and canonical-name preservation, immutable resend/verification, cooldowns, stale sends, duplicate submissions, 429/503 recovery, test-flow switching, map/node/layout destination restoration and 320–390 px layouts. The complete local/hosted suite and the coordinated production release remain pending.

## User experience

- Open the account screen on **Sign in**, with a clearly visible **Create account** alternative. Only account creation displays and requires the initial name. Explain that normal accounts use an emailed code and have no password to remember.
- Show the email being verified on the code screen. Provide separate **Resend code** and **Change email** controls. Changing the address or switching intent clears the previous code and pending verification state.
- Retain the pending email and intent while the code is entered; verification must not accidentally use a newly edited address. Signup retries retain the entered name until the flow is completed or cancelled.
- Disable duplicate sends and verification submissions while a request is pending. Use a resend cooldown consistent with the configured provider interval; the server's rate limit remains authoritative. Do not advertise an unverified expiry time.
- Keep the code field friendly to paste, numeric keyboards and one-time-code autofill. Retain the existing supported code-length range. Use clear labels, visible focus, live status/error messages and layouts that fit narrow screens and enlarged text.
- Keep the requested destination through sign-in, including a map, comparison, node, reply and Canvas / Outline choice. Recheck access when opening it; an unavailable destination returns to the appropriate library with a clear explanation.

## Server contract and account protection

1. Add a validated `intent` of `signin` or `signup` to `/api/auth/code`. Reject missing or unknown intent with a clear refresh instruction for older open clients. Do not infer signup from the presence of a name or silently default to account creation.
2. For `signin`, validate and normalize the email, enforce current eligibility, and send `{email, create_user:false}`. Omit `data` completely, even if a caller supplies a name. There must be no fallback request with `create_user:true` after a failed sign-in.
3. For `signup`, validate the email and initial display name using the existing bounds, enforce the same signup policy, and send `{email, create_user:true, data:{display_name:name}}`. This is initial-profile input, not permission to rename an existing profile.
4. Preserve the canonical profile on both paths. Repeated login, duplicate signup and verification retries must reuse the same identity and existing private map. Do not issue a profile update from code-request or code-verification handlers. Keep explicit profile edits in **Change display name**.
5. Keep verification based on the email and code, with the existing confirmed-email check and secure session cookies. Retain session refresh, sign-out, same-origin JSON requirements and server-only credentials. A display name never determines ownership or facilitator authorization.
6. Normalize the expected unknown-account sign-in outcome to the same generic acknowledgement as an accepted send, for example: “If this address can sign in, a code will arrive shortly.” Show the Create account alternative to everyone. Do not add an unauthenticated account-existence endpoint or expose provider account-existence errors.
7. Distinguish that expected outcome from operational failures. Preserve actionable retry guidance for rate limits, temporary mail/service failures and invalid/expired codes. Normalize only the documented unknown-user response for this request; do not swallow unrelated provider errors as success.

Supabase documents disabling automatic registration with `shouldCreateUser:false`; the corresponding raw HTTP field is `create_user`, as defined in the [OTP endpoint](https://github.com/supabase/auth/blob/master/internal/api/otp.go). The provider currently returns `otp_disabled` when creation is disallowed and the user does not exist. Check that contract again during implementation. See [passwordless email authentication](https://supabase.com/docs/guides/auth/auth-email-passwordless).

The current [email sign-in implementation](https://github.com/supabase/auth/blob/master/internal/api/magic_link.go) passes signup metadata through the new/unconfirmed-user path. Regardless of provider metadata behavior, the existing Harmonious profile must remain authoritative. Test duplicate signup for both confirmed and pending identities rather than relying only on a provider assumption.

## Delivery progress

The validated Worker contract, account screen, request-ordering guards and focused integration/browser coverage are implemented. Existing test-account fixtures now choose the explicit sign-in intent. Authentication needs no database migration; the additive migration in the joint release belongs to notifications.

Complete the full local and hosted checks for the exact source revision, then publish the Worker/client together with Activity and verify live assets and unauthenticated endpoints. Keep the controlled mail check confined to an intended test destination; do not send unsolicited codes to real participants. Record publication only after verification succeeds.

## Acceptance checks

| Area | Required result |
| --- | --- |
| Returning sign-in | Only email and code are required; the outgoing request has `create_user:false` and no metadata, including when a name is maliciously supplied. |
| Unknown email | Sign-in creates no Auth user, profile or map; it gives generic delivery guidance and never retries as signup. |
| New account | Valid signup plus verification creates one identity, one profile and the existing initial private map; retries do not duplicate them. |
| Existing name | A renamed account retains its canonical name after ordinary login, duplicate signup with a different name, refresh and another browser session. |
| Eligibility | Public/invite restrictions, unconfirmed-email rejection and the reserved test-account domain retain current behavior. |
| Codes and retries | Wrong/expired codes, resend cooldown, provider 429/5xx, delayed responses, changed email and double clicks produce clear recoverable states without unintended sends or saves. |
| Session security | Cookie flags, refresh rotation, sign-out, cross-origin rejection and server-only credentials remain covered. |
| Existing workflows | Organizer-issued test accounts and facilitation still work; login returns to the authorized destination in the selected presentation. |
| Accessibility | Both intents and the code screen work with keyboard, paste/autofill, touch, 320–390 px widths and enlarged text. |
| Compatibility | An old client without intent receives a refresh instruction; malformed requests cannot select an implicit signup path. |

## Release and rollback boundaries

Keep the existing SMTP configuration, email-code templates, rate limits, invite policy and disabled CAPTCHA setting unchanged. Recheck the relevant [Supabase changelog](https://supabase.com/changelog) before implementation. Verify new-account and returning-account email templates still deliver a usable code in the controlled test environment; no template redesign or paid provider change is required by this plan.

Use the established source, local-check, hosted-check, deployment and exact-live verification workflow. Record the joint release in deployment status only after it is verified. A rollback restores the previous Worker/client release without rewriting profiles, maps or Auth identities; users of the new screen may need to refresh. Preserve any notification tables and saved inbox state if the application release is rolled back.
