# Points of disagreement and personal outcomes

Implemented September 19, 2026. [Deployment status](deployment-status.md) records the verified live version and applied migration. This increment builds on [existing-node reasons](existing-node-reasons.md).

## Keep understanding and critique in their modes

Compare's existing **Ask** selector gains **What would change your mind?**. It fills an editable question in the same inquiry form and uses the ordinary question/answer flow. It is an optional prompt, not a required disclosure or a test of good faith. Silence produces no automatic classification, judgment or outcome. The saved record remains an ordinary inquiry with action `question`.

Argument gains **Mark point of disagreement** on an ordinary source node, a source-map connection, a reason's statement, an Argument response or a reason's **Supports** connection. This marks where the author thinks the disagreement lies. It does not assert a logical error, change a relationship or replace the existing Challenge tools. A point can be attached to either person's source; it always names the person who recorded it.

The form begins with **Where do you think the disagreement lies?**. A collapsed optional classification can identify facts, reasoning, values or another issue. Several distinct points may address one target. The labels describe the author's assessment; they are not inferred automatically.

## Outcome belongs beneath a point

Open a point and choose **Record my outcome**. Write an assessment and optionally choose **Changed my position**, **More work needed** or **Difference understood**. An optional next-step note can say what evidence or further work would help. Unlabelled text remains valid; no taxonomy is required.

Each person has at most one active outcome per point. Editing it creates a new version and retains earlier wording. Both people's current assessments appear separately, including when they differ. The interface must not convert one person's assessment into a shared Agreed or Resolved status. Someone who wants to describe agreement can say so in their own note; this remains attributed to them.

Challenge controls remain separate: the recipient can accept/maintain, and the challenger can resolve/reopen. Recording an outcome does none of those things and does not edit either worldview or its confidence scores. A point's other participant responds with their own outcome; ordinary reply/challenge chains are not attached to these annotations in this increment.

## Attached display and finding work

Points and outcomes appear in the selected source's existing on-map popover. Small attachment counts identify points on source cards, reasoning cards or Supports markers only where they exist. Collapsed source branches retain access to their annotations. Neither kind creates a free-floating Argument card or a new graph edge.

Existing Argument search can find point descriptions, outcome text and next steps. Opening a result reveals the real statement or inference and then opens its annotation. It must not manufacture a graph card for the annotation or move the graph according to outcome categories. Compare excludes the new controls, notes and counts.

Maintain current camera, source selection, personal folds and draft safeguards. Changing modes parks an unfinished form; changing target still requires an explicit discard decision. Keep tall popovers clear of the measured Argument toolbar, including when it wraps on narrow screens.

## Saved records and safeguards

Both records use the authored discussion store with `kind: reflection`, `layer: arguments`, one immutable target and a required body. They are neither reasons nor challenges:

```text
action: disagreement_point
reflection: { category: '' | facts | reasoning | values | other }

action: outcome
target: { type: entry, entryId: <point id> }
reflection: {
  result: '' | changed_position | more_work | difference_understood,
  nextStep: <text, at most 2,000 characters>
}
```

Only the author can edit or withdraw a record. Point/outcome roles cannot be converted, earlier versions and original source snapshots remain immutable, and reflection metadata is invalid on unrelated contribution kinds. New work requires an available target in the same accessible Comparison. Old wording remains readable after source loss; exact status-only withdrawal remains allowed. Making a participating map private removes the affected participant's access to its shared annotations too.

New saves stay staged until acknowledged. Retrying a lost acknowledgment must recover the saved annotation rather than creating another point or outcome. Concurrent outcome creation by one author must preserve the one-active-outcome rule; two different authors may independently save their assessments. No notification, task assignment, automatic verdict, shared endorsement or source-map change is implied.

Portable schema **6** accepts older workspaces. `comparison-reflection-v1` protects current and historical reflection records from unsupported browser clients before reading/writing them. Unaffected older clients receive their existing envelope. The database migration is additive and service-only; it must not rewrite existing records or widen client access.

## Acceptance

Test two accounts marking source statements and Supports connections, independent outcomes, author-only edits/withdrawals, immutable history, optional classification, next-step limits, source loss and private-map removal. Verify duplicate/retry/concurrent save boundaries, malformed direct database writes and complete-batch rollback. Search, folded branches, mode-switch drafts and narrow screens must retain access while the number of graph cards stays unchanged. The new inquiry preset must preserve edited text and remain an ordinary Compare question.

Compass self-placement, automatic matching, a single reason card with multiple conclusions, manual dragging, pods, task scheduling and inferred consensus remain outside this increment.
