# Attached conversations, reusable definitions and Argument follow-through

Delivered September 12, 2026. See [deployment status](deployment-status.md) for the verified live version.

## Attached conversations

Questions and requests are grouped under a small **?** count in their source node's footer. Challenges use an **!** count. Opening a count shows the attached contributions in a focused window beside or below the source. Closing the window leaves the count visible. Connections and recorded relationships have adjacent counters too; they use the same interaction.

The display controls remain **Map**, **Inquiries** and **Arguments**. Collapsed types retain their indicators, and clicking an indicator opens its contents. When a map branch collapses, its descendants' counts appear on the visible ancestor. Only one conversation window is open at a time. The source layout is unchanged: this release does not add manual dragging or move nodes to accommodate a window.

## Definitions & standards

Open **Map Library → Definitions & standards** to create, edit, archive or restore an author-owned entry. Each edit adds an immutable version. Earlier versions and the entry's existing uses remain available.

Select your own node and choose **Use definitions & standards** in Compare, or **Definitions & standards** from your map's node actions. Your own edges offer the same reference chooser in Compare. Select entries and versions, then save. The definition icon on a compared source opens the exact wording that source invokes.

The central library is private to its author. Another user can read only the wording invoked by an accessible source; they cannot browse unused entries or newer, uninvoked versions. Updating the library does not silently update existing uses. Each use has an explicit version selector. Existing per-source definitions are still readable and author-editable; they are not automatically promoted into library entries.

## Following arguments

**Focus arguments** opens the comparison's challenges, with open items first and a summary of open and resolved counts. It collapses inquiries in the display while leaving their source indicators available. Challenges stay attached to the source or relationship they address.

Open a challenge to respond or inspect its responses. A response links back to the contribution it answers, and responses can themselves be challenged. The other participant can record **Accept challenge** or **Maintain position**, with an explanation. Neither action silently resolves someone else's challenge.

Only the challenger can mark their challenge resolved or reopen it. These are authored, saved contributions with history. “Resolved by challenger” describes that person's decision; it does not claim bilateral agreement or an objective verdict. An open challenge against a relationship adds **Contested** to its label. All earlier argument records remain accessible through View options.

## Validation

- Two-account browser tests cover creation and explicit updating of invoked definitions, source counters, questions, edge challenges, relationship contests, acceptance, resolution, refresh, collapsed branches, draft protection, narrow screens and Full canvas.
- Model and PostgreSQL tests cover immutable library history, foreign edits, forged references, private-map visibility, unchanged pinned versions, invalid outcome authorship and atomic rollback.
- The additive database migration rewrites no existing account rows. Counts and content digests matched before and after applying it.
- Application/account checks, the portable export walkthrough, production build and exact public asset verification pass. The public check also verifies sign-in configuration, denied anonymous workspace access and security headers.

## Remaining product decisions

The next acceptance pass should judge whether source counters and the open-challenge list make conversations easy to follow. Counterpart requests now support direct create-or-choose fulfillment; see [the counterpart workflow](counterpart-workflow.md). Adoption suggestions still require the recipient to edit their map; accepting a suggestion does not automatically copy a node. Multiple pinned windows, richer argument graph layouts, automatic inference and live notifications are not part of this prototype pass. Manual map rearrangement and the future pod model remain deferred.
