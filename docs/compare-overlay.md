# Compare overlay, first implementation

Reference: the owner's 13-page "Mock demo of Harmonious" PDF, especially pages 6–9 and 13. Compare places both worldviews in the same three-frame structure. Differences remain separately readable; questions can be recorded before counterpart judgments are made. Argument is a later, separate view built on comparison records. Pod design is deferred.

## Current behavior

- Both maps use one radial frame layout. A and B source cards remain distinct, including when they have identical text or IDs.
- Sibling paths seed provisional display positions. Spatial proximity is not a counterpart judgment, semantic match, or endorsement. Unequal branches remain visible and independently expandable.
- A uses solid borders and B dashed borders; source badges and highlight controls retain attribution without replacing frame colors.
- Users can select any A/B pair, including nodes outside neighboring display positions. Existing question/answer judgments and source snapshots continue to work.
- "Needs elicitation" records a question for one source or a candidate pair without asserting an answer relationship. Question markers reopen the record; reviewing it later preserves its earlier question and snapshots in history.
- Original maps are not edited by layout, matching, or recording a comparison. The comparison owner's private records do not imply another person's agreement.
- Explore and Pods retain the existing single-map layout.

## Deliberately incomplete

This first pass does not consolidate equivalent statements into one card, reposition branches from user-confirmed semantic matches, create responses in the source maps, or implement the Argument view. Those are further development steps, not demonstrated capabilities of the layout change. The owner reviewed the preview and accepted it as the starting point for further development.

## Validation

Automated checks cover a shared frame centerline, readable cards through 100 expansion/filter combinations, different source IDs, unequal trees, original-map preservation, collapsed endpoints, swapped maps, portable elicitation records, and resolving an elicitation record while preserving history. Application, account, database, autosave and generated Worker suites pass. The in-app browser blocked automated inspection of the local preview; visual acceptance was provided by the owner. See deployment-status.md for the live release status.
