# Sign up and sign in cleanup implementation plan

October 23, 2026. **Status: planned, not implemented.** The optional Canvas / Outline presentation is live in Worker 71 and passed all 70 local and hosted checks plus exact live-asset verification. This is the next proposed authentication increment; retain the current technology stack.

## Outcome and scope

Returning users choose **Sign in**, enter their email address, and enter the code sent to that address. They do not supply a display name or create a password. New users choose **Create account**, provide an email address and initial display name, and verify their email with a code. Keep **Use a test account** as the separate organizer-issued username/password flow.

The same accounts, map IDs, comparisons, contributions, facilitator permissions and saved names remain in place. Password login for normal accounts, social login, passkeys, changes to signup eligibility and changes to email delivery providers are outside this increment. Notifications are a separate implementation plan.

## Current behavior

`dist/account-ui.mjs` currently combines registration and sign-in, requiring a name on every code request. `worker/account-auth.mjs` sends every request to Supabase Auth with `create_user:true` and `data.display_name`. The browser talks to the Harmonious Worker; the Worker uses raw HTTP requests to `/auth/v1/otp` and `/auth/v1/verify`. There is no Supabase JavaScript SDK in this flow, and none needs to be introduced.

The application already has a canonical profile record. `accountWorkspace()` in `worker/account-api.mjs` returns that saved profile name and creates an initial profile/private map only if the profile does not yet exist. The account-menu **Change display name** action updates the profile through an authenticated, owner-only, revision-checked save.

Turnstile and native Supabase CAPTCHA were disabled at the owner's request. Preserve that setting and the dormant challenge component. Email verification, provider rate limits, public/invite eligibility and the separate test-account restrictions remain in force.

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

## Implementation order

1. **Pin the contract in tests.** Extend `tests/account-signup.test.mjs` and `tests/account-api.test.mjs` to cover intent validation, exact outgoing Auth payloads, name preservation, account bootstrap idempotency and error normalization. Confirm current provider error codes and resend settings without changing production configuration.
2. **Update the Worker.** Implement the two request paths in `worker/account-auth.mjs`; adjust `worker/account-api.mjs` only where response contracts require it. Preserve the existing profile bootstrap, test-account endpoint and cookie behavior. No database migration is expected.
3. **Update the account screen.** Refactor the gate in `dist/account-ui.mjs` into explicit intent and code-entry states; adjust `dist/accounts.css` for clear mobile/keyboard layouts. Keep `dist/test-accounts-ui.mjs` working with both normal account choices.
4. **Handle request ordering.** Capture an immutable pending email/intent for each request. Ignore stale results after changing email, changing mode or starting a newer attempt. Clear sensitive code/password fields at the appropriate transitions; keep failed attempts editable without duplicating requests.
5. **Complete browser and integration checks.** Add focused normal-account browser coverage and update `tests/test-accounts-browser.test.mjs`, whose organizer setup currently assumes a required name at sign-in. Preserve facilitator entry, account switching and dirty-work safeguards. Run the existing complete suite.
6. **Publish a coordinated release.** Exercise the changed flow before publication using disposable identities and a controlled test mail destination. After local and hosted checks pass for the exact commit, ship Worker and client together and verify the live assets and unauthenticated endpoints. Do not send unsolicited codes to real participants.

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

Use the established source, local-check, hosted-check, deployment and exact-live verification workflow. Record the new release in deployment status only after it is verified. A rollback restores the previous Worker/client release without rewriting profiles, maps or Auth identities; users of the new screen may need to refresh. Creating this plan sends no email, changes no account and enables no new authentication mechanism.
