# Interaction redesign: protected baseline

Prepared September 22, 2026. The protected baseline remains fixed while the interaction redesign is developed locally.

The owner subsequently authorized the [Inquiry mode foundation](inquiry-mode-foundation.md), followed by the [version 4 interaction grammar](interaction-grammar-v4.md). After local review, the owner requested live publication. The agreed mode-specific actions, contextual disputes, recipient responses, and explicit map changes were deployed September 23, 2026 at 00:25 UTC. Source remains on the redesign branch; the stable tag and `main` remain fixed.

## Checkpoint

- Stable annotated tag: `stable-before-interaction-redesign`.
- Baseline commit: `b9ebc57fb0b317c820b8a0c4990ede7f36a5ce82` (release notes); application source: `9fd13360833057184a045b96594b4d3b3aab0c6f`.
- Working branch for the redesign: `redesign/node-interactions`.
- Local `main` remains at the baseline. Back up the tag and redesign branch to GitHub without moving the remote production branch.
- Full-history local Git bundle: `../harmonious-backups/stable-before-interaction-redesign.bundle`. Its history and integrity were verified with `git bundle verify`.
- Restore rehearsal: cloned the bundle into an ignored local verification directory, checked out the stable tag, verified the exact baseline commit, and ran `git fsck --full` successfully.
- Baseline verification: 46/46 release checks passed, report `build/verification/2026-09-22T17-21-40-805Z-50256/summary.json`.
- Recorded live Cloudflare version: `190c2303-0765-467e-ad97-580da77f8680` (version 40); deployment `63cbc3fa-d918-406f-882d-1c7dd67da15e`.
- Worker SHA-256: `6f0a0d320b089684f353aab0795c970e4fe8ee00df5fa609b809c6ab486e56ae`.

See [deployment status](deployment-status.md) for the release and [the testing checklist](user-testing-checklist.md) for the current working behavior. Preparation adds no application, database or deployment changes; the existing application checks need not be repeated for a tag and documentation-only branch.

## GitHub backup status

Local preparation is complete. The attempted atomic push of the stable tag and redesign branch failed because Git on this PC has no usable GitHub credential. No remote reference was created. The GitHub backup remains pending authentication; it is not a completed off-device backup. The local tag, branch and verified bundle are available for recovery now.

After GitHub authentication is available, push only these prepared references, then verify their remote hashes:

```text
git push --atomic -u origin refs/heads/redesign/node-interactions:refs/heads/redesign/node-interactions refs/tags/stable-before-interaction-redesign:refs/tags/stable-before-interaction-redesign
git ls-remote origin refs/heads/redesign/node-interactions refs/tags/stable-before-interaction-redesign
```

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

Use the live beta for the owner's current testing, following the [interaction checklist](user-testing-checklist.md). The optional `review/Harmonious-interactions-preview.html` still provides disposable sample maps. The grammar document records the decisions that override provisional CSV wording. The new migration is applied and Worker version 41 is live. Existing records were unchanged by deployment; after new grammar records exist, the stable source tag alone is not a safe production rollback.
