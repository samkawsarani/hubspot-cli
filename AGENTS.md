# hubspot-cli — Agent Guide

## Package manager

Use Bun instead of Node.js (`bun` not `node`, `bun install` not `npm install`) for all operations:

```bash
bun install              # install dependencies
bun test                 # run tests
bun run build            # build dist/hubspot.js + dist/lib/
bun run src/cli.ts       # run CLI locally without building
```

## Architecture

Three layers, top to bottom:

- **`cli.ts`** — parses flags, calls business logic, prints JSON. No API calls directly.
- **`hubspot.ts`** — all business logic: `searchContacts`, `searchDeals`, `getCompany`, etc. This is where HubSpot API coordination happens.
- **`client.ts`** — `HubSpotClient` wraps `fetch`. Handles auth header, 429 retries (up to 3), and error parsing. `getClient()` returns a singleton; `loadConfig()` reads env vars.

Config resolution order (highest priority first): local `.env` in cwd → `~/.config/hubspot/.env` → environment variables.

`index.ts` re-exports the public library API from `hubspot.ts` and `client.ts`. The CLI is a separate bundle and is not part of the library.

`dist/` is gitignored — do not commit built files manually.

## Testing

All tests are in `tests/hubspot.test.ts` and use `bun:test`.

**What's mocked:** The HTTP client — tests use `_setClient()` to inject a fake `HubSpotClient`. No real network calls in unit tests.

**What's real:** There are currently no integration tests. To add them, follow the same pattern as `slack-cli`: gate on an env var (`HUBSPOT_ACCESS_TOKEN`) and use `test.skip` when not set.

```bash
bun test                          # run all tests
bun test -t "searchObjects"       # run a single test by name
```

## Local dev workflow

```bash
bun run src/cli.ts search-contacts              # run CLI without building
bun run build                                   # produce dist/hubspot.js

# End-to-end against the real API:
# Set HUBSPOT_ACCESS_TOKEN in ~/.config/hubspot/.env or a local .env, then:
bun run src/cli.ts search-companies --query "Acme"
bun run src/cli.ts get-contact --id 12345
```

## What to avoid

- **Do not call the HubSpot API directly from `cli.ts`** — keep all API calls inside `hubspot.ts` or `client.ts`.
- **Do not pass `HubSpotClient` as a function parameter** — use the `getClient()` singleton.
- **Do not use `_setClient`** outside of tests — it's test-internal infrastructure.
- **Do not export `_setClient` from `index.ts`** — it must not be part of the public library API.
- **Do not add breaking changes to the public library API** (`index.ts` exports) without a major version bump.
- **Always update `CHANGELOG.md`** under `## [Unreleased]` when making any code changes.

## Error handling

`HubSpotClient` throws `APIError` on non-2xx HTTP responses:

```typescript
import { APIError } from "../src/client";

try {
  await getContact("12345");
} catch (e) {
  if (e instanceof APIError) {
    e.statusCode; // number — e.g. 401, 404, 429, 500
    e.message;    // e.g. "HubSpot API error: contact not found"
  }
}
```

401 means bad/missing token. 429 is rate-limited (client retries automatically up to 3 times). `getObject`-based functions (`getContact`, `getCompany`, etc.) return `null` on 404 and throw on all other errors.

## Versioning & releasing

1. Add changes under `## [Unreleased]` in `CHANGELOG.md`
2. Run `./scripts/release.sh patch` (or `minor` / `major`)
   - Bumps `package.json`, renames `[Unreleased]` in `CHANGELOG.md`, commits, and tags
3. Run `git push origin main --tags`
   - GitHub Actions runs tests, builds, creates a GitHub release, and publishes to npm

Follow semantic versioning (`MAJOR.MINOR.PATCH`):
- **patch** (1.0.0 → 1.0.1): bug fixes, minor tweaks
- **minor** (1.0.0 → 1.1.0): new features, new CLI commands, new operations
- **major** (1.0.0 → 2.0.0): breaking changes to CLI interface or public API

## Project structure

```
src/
  client.ts    # HubSpotClient, APIError, getClient(), loadConfig()
  hubspot.ts   # All business logic / CRM operations
  cli.ts       # CLI entry point (commander)
  index.ts     # Public library API re-exports
tests/
  hubspot.test.ts  # Unit tests (bun:test)
dist/          # gitignored — built by scripts/build.sh
  lib/         # Published library (tsc from tsconfig.build.json)
  hubspot.js   # CLI bundle (bun build)
scripts/
  build.sh             # tsc → dist/lib; bundle src/cli.ts → dist/hubspot.js
  release.sh           # Bump version, update CHANGELOG, commit + tag
  extract-changelog.sh # Extract release notes for GitHub releases
.github/
  workflows/
    publish.yml  # Triggered on tag push: test, build, GitHub release, npm publish
```

## CLI Commands

```bash
hubspot init                    # Interactive setup
hubspot search-companies        # Search companies (JSON)
hubspot search-deals            # Search deals (JSON)
hubspot search-tickets          # Search tickets (JSON)
hubspot search-contacts         # Search contacts (JSON)
hubspot get-company --id <id>   # Get company by ID
hubspot get-deal --id <id>      # Get deal by ID
hubspot get-ticket --id <id>    # Get ticket by ID
hubspot get-contact --id <id>   # Get contact by ID
```

Search commands support: `--query`, `--limit` (max 200), `--after` (pagination cursor).

## Configuration

Global config is stored at `~/.config/hubspot/.env` (written by `hubspot init`).
A local `.env` in the working directory overrides the global config.

| Variable | Description |
|---|---|
| `HUBSPOT_ACCESS_TOKEN` | HubSpot Private App access token (required) |

## Adding new operations

1. Add the function to `hubspot.ts` (with typed options interface extending `SearchOptions` or `Omit<SearchOptions, "associationFilters">`)
2. Re-export from `index.ts`
3. Optionally add a CLI subcommand in `cli.ts`
