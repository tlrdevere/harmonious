# Harmonious

Harmonious maps, compares, and helps people reconcile worldviews. This repository contains the public framework and the working software prototype.

## Software prototype

The application includes:

- Radial maps with three frames: **Status Quo**, **Transformative Action**, and **Goal State**. Branches expand and collapse while the layout makes space for them.
- Two maps on one comparison canvas, with recorded question/answer correspondences and retained source snapshots.
- Personal and authored reference maps, explicit co-signs, wording history, and pod memberships derived from those co-signs.
- An independent Cloudflare Worker build with Supabase email-code accounts, PostgreSQL persistence, private/shared maps, ownership checks, and automatic saving.

**Beta status:** the application is implemented and the Supabase database is configured and its access rules are verified. Hosting configuration and real sign-in email delivery must be completed before inviting testers. See [deployment status](docs/deployment-status.md) and [beta setup](docs/independent-beta.md).

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

The original framework text is preserved as the conceptual record. Later prototype decisions, including explicit co-signs as the initial basis for pods, are documented alongside it.

## License

Documentation and framework materials use CC BY 4.0; source code uses the repository's MIT terms. See [LICENSE.md](LICENSE.md).
