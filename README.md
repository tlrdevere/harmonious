# Harmonious

Harmonious maps, compares, and helps people reconcile worldviews. This repository contains the public framework and the working software prototype.

## Software prototype

The application includes:

- Radial maps with three frames: **Status Quo**, **Transformative Action**, and **Goal State**. Branches expand and collapse while the layout makes space for them.
- Two maps on one comparison canvas, with immediate agreement/disagreement, counterpart requests, inquiries, arguments on nodes and edges, and author definitions/standards. Missing counterparts have reserved display spots and a direct create-or-choose flow. Earlier question/answer judgments and their source snapshots remain accessible.
- Personal and authored reference maps, explicit co-signs, wording history, and pod memberships derived from those co-signs.
- An independent Cloudflare Worker build with Supabase email-code accounts, PostgreSQL persistence, private/shared maps, ownership checks, and automatic saving.

**Beta status:** public signup, Map Library, shared overall Comparisons and focused on-map relationships, questions, challenges and requests are deployed. The owner has reported two accounts working. The earlier [Argument view](docs/argument-view.md) remains available for existing proposals. See [deployment status](docs/deployment-status.md), [beta setup](docs/independent-beta.md), and the [next-work plan](docs/next-work-plan.md). Collapsible source attachments, a private reusable definitions/standards library and authored challenge responses/resolution are also live; see [the delivered workflow](docs/attached-conversations-library.md).

The next product pass is captured in the [next-work plan](docs/next-work-plan.md), and the hands-on checks are in the [user-testing checklist](docs/user-testing-checklist.md).

Public source code does not make participant data public. Account records belong in the configured database; credentials and workspace exports must not be committed to this repository.

## Development

Use Node.js 22 or later.

```sh
npm ci
npm run verify
```

`npm run build` creates `build/cloudflare/worker.mjs`. `npm run deploy` publishes through an authorized Cloudflare account after its runtime values are configured. Run these commands from the repository root.

The frontend modules are in `dist/`, account APIs in `worker/`, and the database migration in `supabase/migrations/`. Generated build output is ignored. The Supabase project and Cloudflare Worker are configured separately from GitHub source visibility.

For a portable facilitator demo, run `python scripts/export-standalone.py`; it generates HTML in `review/`. That demo uses workspace files and does not provide authenticated accounts. Earlier Sites worker and SQLite sources are retained for compatibility checks; the original Sites deployment manifest and resources are not part of this independent checkout.

## Framework and design

- [Original framework and process design](docs/framework.md)
- [Co-signing and pod model](docs/endorsement-model.md)
- [Prototype development history](docs/prototype-history.md)
- [Public disclosure and prior-art notice](NOTICE.md)

The original framework text is preserved as the conceptual record. Map Library is the starting point; Compare and Argument are two modes of one Comparison. Existing co-sign-derived pods are a prototype; the future pod design remains undecided.

## License

Documentation and framework materials use CC BY 4.0; source code uses the repository's MIT terms. See [LICENSE.md](LICENSE.md).
