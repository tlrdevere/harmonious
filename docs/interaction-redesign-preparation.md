# Interaction redesign: protected baseline

Prepared September 22, 2026. The protected baseline remains fixed while the interaction redesign is developed locally.

The owner subsequently authorized the [Inquiry mode foundation](inquiry-mode-foundation.md), followed by the [version 4 interaction grammar](interaction-grammar-v4.md). After local review, the owner requested live publication. The agreed mode-specific actions, contextual disputes, recipient responses, and explicit map changes were deployed September 23, 2026 at 00:25 UTC. Source remains on the redesign branch; the stable tag and local `main` remain fixed. The owner has since authorized a workflow-only exception on remote `main` so GitHub can run the manual release checks; this does not authorize application changes or automatic deployment.

## Checkpoint

- Stable annotated tag: `stable-before-interaction-redesign`.
- Baseline commit: `b9ebc57fb0b317c820b8a0c4990ede7f36a5ce82` (release notes); application source: `9fd13360833057184a045b96594b4d3b3aab0c6f`.
- Working branch for the redesign: `redesign/node-interactions`.
- Local `main` remains at the baseline. The protected tag remains fixed; remote `main` may receive only the owner-authorized release-check workflow addition.
- Full-history local Git bundle: `../harmonious-backups/stable-before-interaction-redesign.bundle`. Its history and integrity were verified with `git bundle verify`.
- Restore rehearsal: cloned the bundle into an ignored local verification directory, checked out the stable tag, verified the exact baseline commit, and ran `git fsck --full` successfully.
- Baseline verification: 46/46 release checks passed, report `build/verification/2026-09-22T17-21-40-805Z-50256/summary.json`.
- Recorded live Cloudflare version: `190c2303-0765-467e-ad97-580da77f8680` (version 40); deployment `63cbc3fa-d918-406f-882d-1c7dd67da15e`.
- Worker SHA-256: `6f0a0d320b089684f353aab0795c970e4fe8ee00df5fa609b809c6ab486e56ae`.

See [deployment status](deployment-status.md) for the release and [the testing checklist](user-testing-checklist.md) for the current working behavior. Preparation adds no application, database or deployment changes; the existing application checks need not be repeated for a tag and documentation-only branch.

## GitHub backup status

The initial atomic push failed because Git on this PC had no usable GitHub credential. After authentication, the redesign branch was pushed successfully and its remote hash verified at `e42f83ab9fb97b8484bda96fd935ce0481a105e5`. This completes the GitHub backup of that branch. The stable tag remains local; no GitHub backup of the tag is recorded. The local tag, branch and verified bundle remain available for recovery.

The owner approved adding the prepared workflow-only commit `459f9d59ad7307165d705c75d045d44b615e0c0f` to remote `main` and running the manual hosted release checks against the redesign branch. See [deployment status](deployment-status.md) for the publication and check outcomes. Automatic deployment remains disabled.

## Safe return to the source baseline

Keep the tag fixed. Commit or otherwise preserve any in-progress redesign before changing checkouts. A separate working copy avoids discarding redesign work:

```text
git worktree add --detach ../harmonious-stable-review stable-before-interaction-redesign
```

The verified bundle is an independent source backup. If needed, restore it into a new, empty destination:

```text
git clone ../harmonious-backups/stable-before-interaction-redesign.bundle ../harmonious-restored
git -C ../harmonious-restored switch -c restored-baseline stable-before-interaction-redesign
```

Do not reset the redesign branch or force-push over saved work to inspect the baseline.

## Deployment and data boundary

A Git checkout does not change the public site. Keep redesign testing local or on a separate preview until the new workflow is reviewed and its release checks pass.

The tag and bundle back up source and history, not hosted user records or encrypted service credentials. They are not a database restore point. Before any schema or stored-interaction changes, plan backward compatibility and appropriate data backup/recovery. Existing interactions and their authored history must remain readable.

The recorded Cloudflare version is a deployment reference, not an instruction to roll it back blindly. Before a future rollback, verify that any records or schema created since this checkpoint remain compatible with the older application. Use a forward fix when rollback would strand newer data.

## Current review

Use the live beta for the owner's current testing, following the [interaction checklist](user-testing-checklist.md). The optional `review/Harmonious-interactions-preview.html` still provides disposable sample maps. The grammar document records the decisions that override provisional CSV wording. The new migration is applied; [deployment status](deployment-status.md) records the current live Worker version. Existing records were unchanged by the initial grammar deployment; after new grammar records exist, the stable source tag alone is not a safe production rollback.
