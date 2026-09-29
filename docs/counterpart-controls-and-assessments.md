# Counterpart controls and visible assessments

Approved September 29, 2026 (UTC). Implementation and verification are in progress; [deployment status](deployment-status.md) identifies the live release.

## Behavior

- The counterpart chooser lists available ordinary nodes in the same frame only. Both nodes must be free of a different counterpart in this comparison. Earlier multiple or cross-frame links remain readable and can be unlinked deliberately.
- A linked node offers **Unlink counterpart**. Either map owner can unlink. An immutable, attributed history entry ends the pair's current linking records without deleting either node, editing another person's contribution, or withdrawing their assessments. A later link is a new record.
- Ordinary menus omit **View linked counterparts**, **Link another counterpart**, and **Create counterpart in my map**. Exceptional hidden/earlier connections retain contextual details. **Counterpart history** exposes past links and unlink actions. Creation is offered only to the recipient of an explicit counterpart request and creates an owned node plus its link atomically.
- **Agree** replaces the visible label **Endorse**. Existing stored action identifiers and histories remain compatible.
- Each ordinary card shows the other participant's assessment with a name, text and color: Agree, Disagree, or No position. **Not assessed** is a distinct empty state. Clicking an assessment opens its details; an empty assessment owned by the viewer opens the position choices.
- A one-to-one linked pair shows **Both agree** or **Both disagree** only when the two reciprocal assessments match and their sources are current. Asymmetric, absent, withdrawn, stale and No position assessments produce no mutual verdict. Unlinking clears that pair indicator while retaining personal assessments. Changing older opinion history must not supersede the latest-created assessment.
- The duplicate **Read source** disclosure is removed; source wording and citations remain readable in the node window. Source history remains available on saved interactions.
- Clicking blank canvas closes the transient window. Panning, pinch, cancellation and clicks on controls do not dismiss it. Unsaved drafts retain the existing discard protection and focus restoration.

## Integrity and compatibility

The picker, refreshed save preparation, account validation and database boundary enforce the same link rules. Existing historical pairs are not rewritten. Missing/hidden endpoints do not silently free a slot. Competing saves use the existing snapshot retry protocol, and a lost acknowledgment can be retried without duplicating a link, node or unlink receipt.

If privacy makes a newer assessment unavailable, older assessments cannot reappear as the current opinion or create a false mutual indicator. Original records remain stored. A permitted unlink receipt continues to suppress its named links even when one original record's private reference makes that record unavailable to the viewer.

An additive database migration supports immutable unlink receipts and new-link constraints. Existing author ownership, access projection and service-only database access remain intact. Older tabs encountering the new receipt receive a refresh-required response that preserves their unsaved draft.

Full-size ghosts, straight clear parent connections, source geometry, zoom retention and the established deferral list remain in effect. This does not implement the separate Aligned / In tension assessment proposal.

## Verification

Run the complete release checks, including two-account browser workflows, model/account validation, direct PostgreSQL boundary cases, portable export and production build. Inspect card layout at desktop and narrow widths. Publish the exact tested commit only after hosted checks pass, apply and verify the additive migration, then confirm the public application matches the tested client files.
