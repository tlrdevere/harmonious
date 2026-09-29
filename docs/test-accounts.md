# Organizer-created test accounts

Implemented locally September 29, 2026. Awaiting complete release verification and identification of the organizer's existing Harmonious account before enabling production administration. Worker 58 remains the published baseline; see [deployment status](deployment-status.md).

## Use

The organizer opens their account menu and selects **Test accounts**. Enter a display name and a unique username, then select **Create test account**. Copy the generated login details and share them with that tester through the organizer's preferred channel. Harmonious does not send an invitation or require the tester's email.

The tester chooses **Use a test account** on the sign-in screen and enters their username and password. Each test account has a persistent identity, private starting map and normal participant permissions. Use one account per person. Shared maps are visible to other beta participants under the existing sharing rules.

The organizer can use **Reset password** beside a listed test account to generate replacement login details. The previous password stops working; this is a recovery feature, not a session-revocation or account-deletion control. Credentials are displayed temporarily in the dialog, cleared on close, and never stored in browser storage or the map workspace. Copy them before closing; forgotten passwords are replaced rather than retrieved.

## Implementation and boundaries

- `TEST_ACCOUNT_ADMIN_ID` is a server-side Worker binding containing the exact verified Supabase user UUID of the organizer. Missing/invalid configuration fails closed. A display name, client input or user-editable metadata cannot grant administration.
- The Worker uses the existing Supabase Auth admin API to create individually confirmed users with generated passwords and server-controlled `app_metadata`. Only this path can assign the test-account marker. Existing email-code accounts retain verification.
- Usernames are case-insensitive, 3–32 letters/numbers/underscores/hyphens. Internally they map to reserved `.invalid` addresses, never a tester's mailbox. The application blocks those addresses from its ordinary email-code/verification routes. A reserved address or editable metadata alone cannot open a test account.
- Password sign-in and refresh use Supabase Auth with the existing Secure/HttpOnly/SameSite cookies. No privileged key, password or access token is exposed in API JSON. Sign-in errors and provider rate limits are handled without revealing whether a username exists.
- All create/list/reset endpoints require a freshly identified organizer. Mutation requests retain same-origin and JSON/body-size checks. Password resets are limited to server-marked test users; ordinary email-account credentials cannot be changed here. Lists return only test usernames, display names, IDs and creation dates, with pagination.
- Password creation uses browser Web Crypto (128 random bits) and sends the password only in the same-origin request body. A failed create retains its pending password while the dialog stays open; a duplicate username is never overwritten. If the provider created an account but the acknowledgement was lost, use the listed account's reset action to obtain a known replacement.
- No application database migration, global verification switch, dependency change or new authentication provider is needed. The original technology stack and deferred work remain unchanged.

## Verification

Focused tests cover organizer-only access; forged metadata and reserved-email rejection; duplicate and weak-password rejection; sign-in, reload and password replacement; private starting workspaces; account isolation; credential clearing; existing email sign-in; rate-limit responses; cross-origin rejection; and desktop/narrow layouts. Complete release checks and live verification are required before publication.

Provider references: [Admin user creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [password sign-in](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits).
