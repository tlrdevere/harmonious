# Changing your display name

Published September 29, 2026 as **Worker 60**, source `6434e1e8425f6ed0fc9c401fc44a1de273925c52`. All **57 local and 57 hosted checks passed**, followed by live asset/access verification. See [deployment status](deployment-status.md).

Open your account menu and choose **Change display name**. Enter the name other participants should see, then choose **Save display name**. Both email and organizer-created test accounts can use this setting. Names must contain 1–100 characters; surrounding spaces are removed. Cancel leaves the existing name intact.

The current name appears on maps and contributions, including existing comparisons and Argument dialogue. Your account identity, login email or test username, password, ownership and recorded content stay the same. Other participants see the updated name on their next account refresh. The organizer's test-account list also uses the current name.

The setting updates only the authenticated participant's existing profile through the account API. Profile revision checks prevent overwriting a newer name from another session. Failed saves keep the entered name available for retry; an exact retry after a lost acknowledgement is safe. Map and conversation drafts are not submitted or discarded by changing the name. Auth metadata remains a first-sign-in fallback; the application profile is the canonical display name.

Verification covers owner-only updates, invalid names, stale revisions, retry, unchanged maps/conversations, another participant's view, browser reload, email/test-account access, cancellation, failure recovery and a narrow screen. See [deployment status](deployment-status.md) for publication evidence.
