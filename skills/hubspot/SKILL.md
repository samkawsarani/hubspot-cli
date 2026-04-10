# HubSpot CLI

Use `hubspot` to search and retrieve CRM records from HubSpot.

## Commands

- `hubspot search-companies [--query <q>] [--limit N] [--after <cursor>]` — search companies (JSON)
- `hubspot search-deals [--query <q>] [--limit N] [--after <cursor>]` — search deals (JSON)
- `hubspot search-tickets [--query <q>] [--limit N] [--after <cursor>]` — search tickets (JSON)
- `hubspot search-contacts [--query <q>] [--limit N] [--after <cursor>]` — search contacts (JSON)
- `hubspot get-company --id <id>` — get company by ID (JSON)
- `hubspot get-deal --id <id>` — get deal by ID (JSON)
- `hubspot get-ticket --id <id>` — get ticket by ID (JSON)
- `hubspot get-contact --id <id>` — get contact by ID (JSON)

## Options

- `--query` — full-text search string
- `--limit` — max results (default 10, max 200)
- `--after` — pagination cursor from previous response's `paging.next.after`
- `--id` — HubSpot object ID (numeric string)

## Output format

All commands return JSON. Search commands return `{ results, total, paging }`. Get commands return the record object, or `null` if not found.

## Configuration

Requires `HUBSPOT_ACCESS_TOKEN` (HubSpot Private App token).
Stored at `~/.config/hubspot/.env` after running `hubspot init`.
A local `.env` in the working directory overrides the global config.

## Typical agent workflow

1. `hubspot search-companies --query "Acme" --limit 5` to find matching companies
2. `hubspot get-company --id <id>` to fetch full details
3. Use `paging.next.after` from search results with `--after` for pagination
