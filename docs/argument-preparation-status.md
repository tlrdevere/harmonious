# Argument preparation: complete

Prepared September 18, 2026 (New York). This records preparation for the [next-week plan](next-week-plan-2026-09-21.md), not a new application release.

## Recoverable baseline

- Local commit `94a8033` checkpoints the accumulated comparison prototype, tests, migration files and documentation before Argument integration. It was not pushed.
- An additional local source archive and SHA-256 file manifest are retained under the ignored `review/pre-argument-baseline/` directory. The archive excludes ignored local configuration, credentials, generated builds and dependency folders. A targeted credential-pattern scan found no matches in the 109 included source files; this was a checkpoint check, not a comprehensive security audit.
- Four newly tracked migration files had a trailing empty line removed to pass the staged whitespace check. Their SQL statements were unchanged; no migration was applied.

## Baseline results

| Check | Result |
| --- | --- |
| Eight application test scripts in `package.json` | Passed |
| Thirteen account/model/database/auth test scripts | Passed |
| Three two-account browser walkthroughs | Passed in headless Edge using isolated local test stores |
| Standalone export | Generated successfully; portable navigation walkthrough passed |
| Independent production build | Passed |
| Built routing, frontend module graph, account gate and security-header check | Passed |
| Staged whitespace check | Passed after the formatting-only cleanup above |

The packaged runtime provides Node but no npm executable. The same test commands listed in the package scripts were therefore executed directly with Node, in their declared order. The first production build attempt hit the Windows filesystem sandbox while the compiler inspected parent directories. Rerunning only the build and built-output check with the approved broader filesystem access passed. This was an environment restriction, not an application failure. The initial attempt remains in the local check log.

These checks establish the existing baseline. They do not establish that the planned Argument features already work, and they do not replace the owner's live usability feedback. No registry audit, package installation, live account mutation, database migration or deployment was performed in this preparation pass.

## Integration decision

Use the current Comparison `discussions` for new **reason** contributions. Their support connection is derived from the saved target; an **inference target** allows a challenge to address the connection separately from the statement. This extends the current system without a third graph store or a proposal prerequisite.

Keep older proposal-based Argument records and routes through **Earlier reasoning**. Preserve authorship, source wording, explicit library versions, privacy and existing histories. Add an explicit compatibility boundary before new records are enabled so older open browser sessions cannot corrupt or misread the new format.

The complete implementation contract is [Argument integration design](argument-integration-design.md), including the additive database validation change and its rollout requirements.

## On-map interaction sketch

Open [the clickable sketch](design/argument-interaction.html). It uses fictional content and in-memory demonstration state only. It does not connect to Harmonious accounts or save work. The preview-account selector is a walkthrough aid, not a proposed account-switch control for the application.

1. As Taylor, choose **Explain my reasoning**, then **Add to argument**.
2. Switch the preview to Morgan and select **supports** between the reason and position. Add a challenge to that inference.
3. Switch to Taylor and **Respond**. Optional references belong inside the explanation.
4. Switch back to Morgan to resolve or reopen the challenge. Taylor's **Accept challenge** does not resolve it.
5. Switch between Compare and Argument, or use the source counts to collapse/reopen the reasoning. Open the definition icon to inspect the invoked library version.

**Show complete example** opens the full chain immediately. The sketch also distinguishes challenges to the source claim and to the reason itself. Desktop and narrow layouts were rendered and inspected. Browser interaction checks passed for the main chain, target labels, outcomes, mode switching, collapse/reopen and definitions, with no page errors or horizontal overflow at 390 pixels.

The sketch demonstrates one chain, its relative placement, controls and collapse behavior. It is not a complete graph editor or a persistence/privacy implementation. Further reasons, multiple simultaneous challenges, full history, source-change warnings, automatic large-map layout and account safeguards remain application implementation work specified in the design and acceptance plan. Mobile uses a stacked reading order; the current desktop sketch layout must not become saved source-map coordinates.

## Acceptance and next action

The [acceptance plan](argument-acceptance-plan.md) defines the two-person flow, distinguishes a claim challenge from an inference challenge, and maps existing coverage to new tests required. It includes ownership, drafts, source changes, concurrent saves, library versions, privacy, compatibility and one-visible-edge behavior.

Preparation is complete; no product decision blocks the first implementation slice. Begin with the reason/inference model and its authorization, snapshot and database tests, then connect the on-map interaction. The end-to-end deliverable remains a saved position → reason → challenge → response flow, not only a reason form.
