# Harmonious

**Harmonious is an open framework and prototype process for mapping, comparing, and reconciling worldviews.**

Its goal is not to force universal agreement. Its goal is to make agreement, disagreement, uncertainty, and asymmetry legible enough that people can understand one another more accurately, identify where consensus is actually possible, and coordinate around the next shared step.

Harmonious is currently a **process prototype**, not a finished software platform. The present version is designed to be run by facilitators using existing tools such as Miro and spreadsheets while the software model is developed.

---

## Project status

**Current stage:** public white paper / process design / facilitated prototype

**Current implementation:**

- Facilitator-led worldview mapping sessions
- Miro boards for visual mapping and comparison
- Spreadsheet-based convergence workbook for structured record-keeping
- Manual pod map construction from individual maps and correspondence judgments
- Reconciliation sessions for confirmed divergences

**Not yet built:**

- A standalone web application
- Automated map layout
- Account/user management
- Group-scale aggregation software
- AI-assisted node matching or fact-checking
- Privacy, moderation, and governance systems

This repository captures the current public state of the project so that the framework can be shared, critiqued, adapted, and developed in the open.

---

## Why Harmonious exists

Most large-scale public discourse is structurally bad at disagreement. People argue through compressed slogans, identity signals, fragmented evidence, and mismatched assumptions. Even when participants are sincere, they often fail to distinguish among very different kinds of conflict:

- Do we disagree about facts?
- Do we interpret the same facts differently?
- Do we want different outcomes?
- Do we share the same goal but disagree about means?
- Are we even answering the same question?

Harmonious begins from the premise that many conflicts become more tractable when worldviews are made explicit as structured maps. The aim is to help people see not merely *that* they disagree, but *where*, *how*, and *why*.

The project is especially concerned with problems where coordination matters: civic decision-making, political strategy, organizational conflict, coalition-building, public consultation, moral inquiry, and collective action.

---

## Core orientation

Harmonious is built around several commitments:

1. **Clarity before resolution.** The platform succeeds when users understand where agreement exists, where it is possible, and where difference may be irreducible.
2. **Authenticity before comparability.** Users should not be pressured to express their worldview in someone else's language just to make comparison easier.
3. **Process integrity.** Any consensus produced by the process is only as legitimate as the process that produced it.
4. **Facilitation as a core feature.** Human facilitation is not a temporary workaround. Especially in early use, it is part of the method.
5. **Emergent structure over imposed ontology.** Harmonious provides a process for mapping and comparison, not a predetermined worldview.
6. **Consensus as a loop, not a final map.** The goal is often not a complete merged worldview. It may be enough to converge on one shared action, act, and then remap against changed conditions.

---

## The three active frames

The current MVP framework uses three active frames.

### 1. Status Quo

How a person understands the world as it currently is. This frame includes:

- **Present:** claims about current reality
- **History:** claims about how present conditions came to be
- **Likely Future:** projections about what will happen if no action is taken

Status Quo nodes are descriptive claims. They may be uncertain or probabilistic, especially when evidence is incomplete.

### 2. Goal State

How a person believes the world should or could be. These are normative claims about a desired future. They are rooted in values, interests, ideals, and moral commitments, but they may still evolve through reflection and dialogue.

### 3. Transformation

How a person believes change happens. These nodes describe mechanisms, strategies, theories of change, and pathways from the Status Quo toward the Goal State.

### Deferred frame: Philosophy / Ontology

The earlier version of the project included a fourth frame: Philosophy or Ontology. That frame remains conceptually relevant, but it is not part of the MVP mapping process. For now, deeper philosophical commitments are surfaced when they become necessary during reconciliation.

---

## Worldview maps

A worldview map is a graph of claims and relationships.

At the simplest level, a map contains:

- **Nodes:** claims, questions, examples, grounds, evidence, or values
- **Edges:** relationships among nodes
- **Frames:** Status Quo, Goal State, and Transformation

### Core node kinds

- **Topic:** a domain of concern, usually implicit in the frame or branch structure
- **Question:** a point of inquiry; the unit of comparability between maps
- **Position:** an answer or claim; the thing most people naturally express when mapping
- **Explainer:** an example or illustration attached to a claim

### Reconciliation-layer node kinds

These appear only when a divergence is opened:

- **Grounds:** a reason a position is held
- **Evidence:** factual support for a claim, ideally with sources
- **Value:** a deeper value a position serves

### Edge types

Harmonious distinguishes several kinds of relationships:

- **Structural edges:** decomposition, specification, answer, and nesting
- **Within-frame relational edges:** causal, related, and illustrative
- **Cross-frame edges:** Status Quo to Transformation, Transformation to Goal State, and Status Quo/Goal State counterparts
- **Reconciliation edges:** supports, evidence-for, and rebuts

The current architecture treats all of this as one integrated graph. Reconciliation reasoning is not a separate layer detached from the worldview. It is worldview content revealed at greater depth when a divergence requires it.

---

## The process

Harmonious has three main process phases.

### Phase 1: Individual mapping

Each participant first builds their own map. The purpose is to capture their genuine worldview before comparison with others.

A typical individual mapping process:

1. Start with the participant's highest-level Goal State.
2. Elaborate that Goal State into more specific nodes.
3. Map the relevant Status Quo: present conditions, historical causes, and likely future.
4. Add Transformation nodes that explain how the gap between Status Quo and Goal State could be closed.
5. Add relationships among nodes.
6. Review the map for accuracy, specificity, and missing pieces.

The facilitator helps clarify and structure the participant's own thinking but does not co-author the map or steer it toward a preferred position.

---

### Phase 2: Convergence

Convergence is the process of comparing two or more maps. It is not the same thing as agreement.

Convergence has two distinct steps.

#### Step 1: Question convergence

Participants first identify whether their nodes are addressing the same underlying question. This prevents the common failure mode of debating answers before it is clear whether the parties are answering the same question.

Possible outcomes include:

- **Matched:** both maps address the same question
- **Unmatched but relevant:** one map raises a question the other has not addressed
- **Incommensurable:** similar-looking nodes are actually answering different questions
- **Redundant:** multiple nodes within a map address the same question at different levels

#### Step 2: Answer convergence

Once a shared question is established, participants compare positions.

Possible outcomes include:

- **Aligned:** substantially the same position
- **Partially aligned:** some shared content, some divergence
- **Divergent:** genuinely different positions
- **Asymmetric:** one participant has a position and the other has not answered the question

Before a divergence is recorded as real, Harmonious uses **cross-elicitation**: each participant's position is presented to the other as a fresh question. Many apparent disagreements turn out to be gaps in elicitation rather than genuine conflicts.

---

### Phase 3: Reconciliation

Reconciliation begins only after a divergence survives cross-elicitation.

The purpose is not to win an argument. The purpose is to locate the fork: the precise point where the participants' reasoning separates.

Each confirmed divergence is worked through using four moves:

1. **Open:** ask why each participant holds the position; elicit grounds only when needed.
2. **Classify:** determine whether the fork is factual, logical, values-based, or layered.
3. **Branch:** use the appropriate method for that kind of disagreement.
4. **Terminate honestly:** mark the outcome as resolved, productively deferred, or precisely irreducible.

### Types of disagreement

- **Factual disagreement:** different beliefs about what is true; potentially resolvable through evidence.
- **Logical disagreement:** shared premises but different inferences; potentially resolvable through reasoning.
- **Values disagreement:** different weighting of values; often not fully resolvable, but the true width of the disagreement can be narrowed.

A key diagnostic question is: **What would change your mind?**

If participants can name evidence or reasoning that would update their position, the disagreement may be live and resolvable. If not, the divergence may be a values fork or an irreducible commitment that should be understood rather than forced.

---

## Pod maps

A **pod map** is the artifact produced whenever two or more maps are compared.

A pod map is not directly authored. It is a derived view computed from:

- individual maps,
- correspondence judgments,
- endorsed merges,
- unresolved divergences,
- asymmetries,
- and provenance links back to source nodes.

Individual maps remain the source of truth. A participant edits their own map; the pod map updates as a view over the relationship among maps.

A pod map can show:

- where participants genuinely agree,
- where they disagree,
- where one person has a position the other has not addressed,
- and where further reconciliation is needed.

At group scale, a group map is simply a pod map with more participants and an explicit agreement threshold.

---

## Current prototype

The current prototype is intentionally low-tech.

### Miro

Miro is used for visual mapping. A board may include:

- individual map zones,
- a shared map or pod map zone,
- a divergence registry,
- an argument mapping zone,
- and session notes.

### Spreadsheet workbook

A convergence workbook is used as the main structured record. The current workbook model includes:

- README / process tracker
- Map A and Map B sheets
- Edges sheet
- Convergence Worksheet
- Pod Map
- Divergence Registry

The spreadsheet is not merely a temporary convenience. It reveals the underlying data model clearly: worldview maps are graphs of nodes and typed edges, and convergence is a structured set of correspondences among nodes.

### Facilitated sessions

Early sessions are facilitator-led. The facilitator may prepare candidate correspondences and neutral questions in advance, but participants must endorse merges and confirm divergences. Solo preparation produces proposals; participant endorsement produces legitimate convergence.

---

## Software development priorities

The likely development path is:

1. Individual mapping interface
2. Side-by-side map comparison
3. Shared/pod map builder
4. Divergence registry
5. Group map aggregation with adjustable thresholds
6. Reconciliation tools: argument mapping, evidence attachment, and outcome records
7. AI assistance: semantic node matching, fact-checking support, logic checks, and summarization

A cross-cutting requirement is **consequence propagation**: when a node or judgment changes, the system should flag downstream nodes and prior convergences that may need to be revisited. This is bookkeeping, not automated adjudication. Harmonious should help participants see the implications of their own judgments; it should not declare winners.

---

## Relationship to prior work

Harmonious overlaps with argument mapping, deliberation, and computer-supported collaborative reasoning. It should reuse established grammars and tools where possible rather than inventing unnecessary new structures.

Relevant conceptual influences and neighboring tools include:

- IBIS
- Toulmin argument model
- value-based practical reasoning
- DebateGraph
- Kialo
- Argdown
- other argument-mapping and deliberation systems

What Harmonious adds is the combination of:

- individual three-frame worldview maps,
- question convergence before answer comparison,
- cross-elicitation before confirmed divergence,
- pod maps with provenance back to individual maps,
- lazy elicitation of grounds only when a divergence requires it,
- collaborative locate-the-fork reconciliation,
- and a consensus loop aimed at shared next actions rather than total worldview merger.

---

## Use cases

Potential use cases include:

- facilitated dialogue across ideological divides,
- civic deliberation and public consultation,
- coalition-building,
- organizational strategy,
- conflict resolution,
- political education,
- participatory policy development,
- collaborative research and moral inquiry,
- and movement strategy development.

The first likely users are not casual social media users. They are facilitators, organizers, civic leaders, researchers, educators, and engaged participants willing to do serious cross-worldview work.

---

## Open questions

The project is intentionally in flux. Major open questions include:

- How much structure should be pre-defined, and how much should emerge from each community?
- How should facilitators be trained and held accountable?
- How should the platform handle bad-faith actors?
- What privacy protections are required for sensitive worldview data?
- How public or private should pod maps be?
- How should group maps handle changing membership over time?
- When should cross-elicitation happen live versus asynchronously?
- How should the system detect converged language that becomes so general it loses action relevance?
- Should the core unit be a persistent accumulating map, or a versioned loop: map, converge, act, remap?

---

## Repository roadmap

Suggested near-term repository structure:

```text
harmonious/
  README.md
  LICENSE.md
  NOTICE.md
  docs/
    process-design.md
    facilitator-guide.md
    participant-onboarding.md
    node-quality-guide.md
  templates/
    miro-board-outline.md
    convergence-workbook-schema.md
  examples/
    two-person-simulation.md
    sample-node-table.csv
    sample-edge-table.csv
```

The immediate next materials to develop are:

- facilitator guide,
- participant onboarding guide,
- Miro template outline,
- node quality guide,
- convergence workbook schema,
- and a clean two-person example.

---

## Public disclosure and prior art notice

This repository publicly discloses the Harmonious framework and its associated concepts as of June 25, 2026.

Harmonious builds on and supersedes the earlier project name **Unanimous**, whose framework was publicly disclosed as of May 20, 2025. This public disclosure is intended to help establish prior art and prevent enclosure of the core framework, process, and concepts.

The project is shared so that others may study, adapt, critique, and build on the framework in the open.

---

## Use ethos

Harmonious is intended to support truthful, transparent, good-faith efforts at understanding and coordination. Users and contributors are encouraged to apply it in ways that preserve:

- authenticity,
- fairness,
- transparency,
- intellectual humility,
- evidence-responsiveness,
- participant agency,
- and non-manipulative facilitation.

The framework should not be used to manufacture false consensus, manipulate participants, obscure power, or launder predetermined conclusions through the appearance of process.

---

## License

Unless otherwise noted:

- **Documentation, process materials, templates, diagrams, examples, and conceptual framework text** are licensed under the **Creative Commons Attribution 4.0 International License (CC BY 4.0)**.
- **Source code**, if and when added, is intended to be licensed under the **MIT License** unless a different code license is specified in the relevant file or directory.

See [LICENSE.md](LICENSE.md) for details.

---

## Repository description

A worldview-mapping and convergence framework for making agreement, disagreement, asymmetry, and possible shared action legible across individuals and groups.
