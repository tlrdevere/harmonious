# On-map comparison conversations

**September 12 update:** conversation cards have been replaced by collapsible source counters and a focused attached list. Definitions now come from **Map Library → Definitions & standards** with explicit version references. **Focus arguments** supports navigating challenge responses and author-controlled resolution/reopening. The current behavior supersedes the earlier presentation details below; see [attached conversations, library and outcomes](attached-conversations-library.md).

Latest focused-action update deployed September 12, 2026 at 03:22 UTC. See [deployment status](deployment-status.md).

## Using the map

Select one node in each worldview, then choose **Agreement** or **Disagreement** beside the selection. A connection appears immediately and says who recorded it. Open it to ask about the relationship. The other participant can **Contest agreement** or **Contest disagreement**; this adds a visible challenge without erasing the recorded relationship. The recording author can edit or withdraw it. Neither a shared question nor the other author's co-sign is required. Source nodes remain separate.

Select your own node to **Request counterpart** or **Suggest adoption**. A counterpart request asks the other map's author to add a corresponding node. An adoption suggestion asks them to consider the selected node's position in their own map. They can respond to either request. Counterpart requests now offer **Create counterpart** and **Choose existing node** directly on the comparison. Adoption still uses the map editor. See [counterpart workflow](counterpart-workflow.md).

Select another person's node or edge to **Ask** or **Challenge**. Ask offers a free question, explanation, example or evidence request. Challenge offers **General challenge**, **Reasoning does not follow**, **Counterexample**, and **Logical fallacy or reasoning error**. Each preset still requires the participant to explain the issue in their own words. Relationships have their own **Ask about relationship** and **Contest relationship** actions. Tree edges support keyboard selection with Tab and Enter.

Existing node-specific definitions and standards remain readable through **View definitions & standards** and editable by their author. New node-specific definitions are no longer created from the comparison canvas. The next design introduces a central, author-owned definitions and standards library whose entries can be invoked from multiple nodes and edges.

Inquiry and argument cards use distinct shapes, labels and colors, with attachment lines to their targets. Open a question or request to respond; open your own contribution to edit or withdraw it. Generic Reply, Support and Add evidence actions are no longer shown on relationships. Replies retain their authors and changes retain earlier wording. **Conversations** offers a list when an item is hard to locate.

**Map**, **Inquiries**, and **Arguments** currently control visibility. The composer stays next to its selected source where space permits and remains within the canvas on narrow screens. **Refresh** fetches the other participant's saved work when no local draft or save is pending. Wait for **All changes saved** before leaving. The file export instead requires downloading the workspace.

## Existing work and deferred scope

Earlier judgments remain behind **Earlier records**; selecting one opens its existing review form. Earlier Argument maps retain their own view and deep links. New conversations attach directly to the overall Comparison and its source items, so they do not need an earlier proposal. Existing judgments are not automatically converted into new unilateral relationships.

Node dragging, manual rearrangement, Bring together, manual position persistence, and changes to the underlying node auto-positioning are explicitly deferred. Conversation cards still use automatic placement, and camera fitting includes those cards. A forthcoming layout pass will replace the scattered cards with collapsible appendages anchored to their source nodes while keeping a visible count or marker when collapsed. Jointly merging nodes remains future design work.

## Storage and verification

`discussion` records store authored relationships, requests, inquiries, arguments, replies and source context. The Worker validates author ownership, comparison membership, available sources, target identity and revision history. Shared conversations are withheld when either source is unavailable to the participant; source context follows map visibility. The existing service-role-only database access remains in place.

The PostgreSQL migration extends the permitted record kinds, adds an index and an identity trigger, and updates the existing atomic commit function. Pre/post-migration record counts and content digests were identical. No live test contributions were created.

Validation passed: application/account suites; real PostgreSQL migration, authorization and rollback checks; new two-context browser walkthrough covering all five features, replies, visibility, drafts and mobile; earlier navigation/Argument walkthrough; portable export; generated Worker routing and asset graph; exact public frontend comparisons and unauthenticated endpoint checks.

Supabase's security advisor reported the existing [RLS-without-policy notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), consistent with intentional server-only access, and [disabled leaked-password checking](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Harmonious uses email-code sign-in; this release does not change authentication settings.
