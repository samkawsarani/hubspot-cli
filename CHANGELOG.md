# Changelog

## 1.1.0

- Config now written to `~/.config/hubspot-cli/.env` (global, works from any directory)
- Added `load_config()` helper: loads global config then local `.env` override
- Added `--version` flag to CLI
- Improved `init` confirmation message with next-steps guidance
- Updated README Configuration section with local override docs

## 1.0.0

Initial release of hubspot-cli.

- HubSpot CRM API client with retry logic and rate limiting
- Search operations: companies, deals, tickets, contacts
- Get operations: company, deal, ticket, contact by ID
- Interactive `init` command for credential setup and validation
- CLI with argparse subcommands
